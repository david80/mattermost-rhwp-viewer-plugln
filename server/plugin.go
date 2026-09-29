package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin

	cacheLock sync.RWMutex
	cacheDir  string
}

type PreviewResponse struct {
	PageCount int      `json:"pageCount"`
	Pages     []string `json:"pages"`
	Error     string   `json:"error,omitempty"`
}

func (p *Plugin) OnActivate() error {
	p.cacheDir = filepath.Join(os.TempDir(), "mattermost-rhwp-cache")
	if err := os.MkdirAll(p.cacheDir, 0755); err != nil {
		p.API.LogError("Failed to create cache dir", "err", err.Error())
	}
	p.API.LogInfo("Mattermost RHWP Viewer plugin activated (rhwp server backend)")
	return nil
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Path format: /api/v1/preview/{fileId}
	path := strings.TrimPrefix(r.URL.Path, "/")
	parts := strings.Split(path, "/")
	if len(parts) < 4 || parts[0] != "api" || parts[1] != "v1" || parts[2] != "preview" {
		http.NotFound(w, r)
		return
	}

	fileId := parts[3]
	if fileId == "" {
		http.Error(w, "File ID required", http.StatusBadRequest)
		return
	}

	// Fetch file metadata and bytes from Mattermost storage
	fileInfo, appErr := p.API.GetFileInfo(fileId)
	if appErr != nil {
		p.API.LogError("Failed to get file info", "fileId", fileId, "err", appErr.Error())
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	fileBytes, appErr := p.API.GetFile(fileId)
	if appErr != nil {
		p.API.LogError("Failed to get file content", "fileId", fileId, "err", appErr.Error())
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Compute content hash for persistent caching
	hash := sha256.Sum256(fileBytes)
	hashStr := hex.EncodeToString(hash[:])
	docCacheDir := filepath.Join(p.cacheDir, hashStr)

	// Check cache with read lock
	p.cacheLock.RLock()
	cachedPages, err := p.readCachedPages(docCacheDir)
	p.cacheLock.RUnlock()

	if err == nil && len(cachedPages) > 0 {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(PreviewResponse{
			PageCount: len(cachedPages),
			Pages:     cachedPages,
		})
		return
	}

	// Cache miss: convert under write lock
	p.cacheLock.Lock()
	defer p.cacheLock.Unlock()

	// Double-check cache under write lock
	if cachedPages, err := p.readCachedPages(docCacheDir); err == nil && len(cachedPages) > 0 {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(PreviewResponse{
			PageCount: len(cachedPages),
			Pages:     cachedPages,
		})
		return
	}

	pages, convertErr := p.convertDocumentToSvg(fileInfo.Name, fileBytes, docCacheDir)
	if convertErr != nil {
		p.API.LogError("Document conversion failed", "fileId", fileId, "fileName", fileInfo.Name, "err", convertErr.Error())
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PreviewResponse{
			Error: convertErr.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(PreviewResponse{
		PageCount: len(pages),
		Pages:     pages,
	})
}

func (p *Plugin) convertDocumentToSvg(fileName string, fileBytes []byte, outDir string) ([]string, error) {
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create doc cache dir: %w", err)
	}

	ext := filepath.Ext(fileName)
	if ext == "" {
		ext = ".hwp"
	}

	tempInputPath := filepath.Join(outDir, "input"+ext)
	if err := os.WriteFile(tempInputPath, fileBytes, 0644); err != nil {
		return nil, fmt.Errorf("failed to write temp input file: %w", err)
	}
	defer os.Remove(tempInputPath)

	rhwpBin, err := p.findRhwpBinary()
	if err != nil {
		return nil, fmt.Errorf("rhwp binary error: %w", err)
	}

	// Execute: rhwp export-svg <input> -o <outDir> --json
	cmd := exec.Command(rhwpBin, "export-svg", tempInputPath, "-o", outDir, "--json")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("rhwp export-svg failed: %w (output: %s)", err, string(output))
	}

	return p.readCachedPages(outDir)
}

func (p *Plugin) readCachedPages(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var svgFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".svg") {
			svgFiles = append(svgFiles, filepath.Join(dir, e.Name()))
		}
	}

	if len(svgFiles) == 0 {
		return nil, fmt.Errorf("no svg files found in %s", dir)
	}

	sort.Strings(svgFiles)

	var pages []string
	reId := regexp.MustCompile(`\bid="([^"]+)"`)
	reUrl := regexp.MustCompile(`url\(#([^)]+)\)`)
	reHref := regexp.MustCompile(`href="#([^"]+)"`)

	for i, fpath := range svgFiles {
		content, err := os.ReadFile(fpath)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s: %w", fpath, err)
		}

		svgStr := string(content)
		// Correct any misplaced signature/seal images that rhwp anchored incorrectly above table
		svgStr = fixMisplacedSignatures(svgStr)

		// Scope SVG IDs so multi-page SVGs don't collide
		prefix := fmt.Sprintf("p%d-", i)
		svgStr = reId.ReplaceAllString(svgStr, `id="`+prefix+`$1"`)
		svgStr = reUrl.ReplaceAllString(svgStr, `url(#`+prefix+`$1)`)
		svgStr = reHref.ReplaceAllString(svgStr, `href="#`+prefix+`$1"`)

		pages = append(pages, svgStr)
	}

	return pages, nil
}

type textMarker struct {
	x float64
	y float64
}

var (
	reTextMarker   = regexp.MustCompile(`<text\s+[^>]*?x="([0-9.]+)"[^>]*?y="([0-9.]+)"[^>]*>([^(<]*?(?:인|서명)[^<]*?)</text>`)
	reRotatedImage = regexp.MustCompile(`(?s)<g transform="rotate\(([0-9]+),([0-9.]+),([0-9.]+)\)">\s*(<image\s+[^>]*?x=")([0-9.]+)"(\s+y=")([0-9.]+)"(\s+width=")([0-9.]+)"(\s+height=")([0-9.]+)"([^>]*)>\s*</g>`)
	reImageTag     = regexp.MustCompile(`<image\s+([^>]*?)x="([0-9.]+)"\s+y="([0-9.]+)"\s+width="([0-9.]+)"\s+height="([0-9.]+)"([^>]*)>`)
)

// fixMisplacedSignatures detects floating signature/stamp images placed at paragraph start
// instead of their corresponding (인) / (서명) row and aligns them accurately, including rotations.
func fixMisplacedSignatures(svgStr string) string {
	markers := []textMarker{}
	textMatches := reTextMarker.FindAllStringSubmatch(svgStr, -1)
	for _, m := range textMatches {
		txt := strings.TrimSpace(m[3])
		if txt == "인" || txt == "(인)" || txt == "서명" || txt == "(서명)" ||
			strings.HasSuffix(txt, "(인)") || strings.HasSuffix(txt, "(서명)") ||
			strings.HasSuffix(txt, "인)") || strings.HasSuffix(txt, "서명)") {
			x, errX := strconv.ParseFloat(m[1], 64)
			y, errY := strconv.ParseFloat(m[2], 64)
			if errX == nil && errY == nil {
				markers = append(markers, textMarker{x: x, y: y})
			}
		}
	}

	if len(markers) == 0 {
		return svgStr
	}

	// 1. First process rotated images: update both rotation pivot (cx, cy) and image coordinates
	svgStr = reRotatedImage.ReplaceAllStringFunc(svgStr, func(tag string) string {
		sub := reRotatedImage.FindStringSubmatch(tag)
		if len(sub) < 13 {
			return tag
		}
		angle := sub[1]
		oldCx, errCx := strconv.ParseFloat(sub[2], 64)
		oldCy, errCy := strconv.ParseFloat(sub[3], 64)
		w, errW := strconv.ParseFloat(sub[9], 64)
		h, errH := strconv.ParseFloat(sub[11], 64)
		if errCx != nil || errCy != nil || errW != nil || errH != nil {
			return tag
		}

		if w > 250 || h > 250 || w < 15 || h < 15 {
			return tag
		}

		for _, marker := range markers {
			if oldCx >= marker.x-100 && oldCx <= marker.x+100 && oldCy < marker.y-35 {
				targetCx := marker.x - 15.0
				targetCy := marker.y - 6.0
				newX := targetCx - w/2.0
				newY := targetCy - h/2.0
				return fmt.Sprintf("<g transform=\"rotate(%s,%.2f,%.2f)\">\n%s%.2f\"%s%.2f\"%s%.2f\"%s%.2f\"%s>\n</g>",
					angle, targetCx, targetCy, sub[4], newX, sub[6], newY, sub[8], w, sub[10], h, sub[12])
			}
		}
		return tag
	})

	// 2. Process non-rotated images
	return reImageTag.ReplaceAllStringFunc(svgStr, func(imgTag string) string {
		sub := reImageTag.FindStringSubmatch(imgTag)
		if len(sub) < 7 {
			return imgTag
		}
		imgX, errX := strconv.ParseFloat(sub[2], 64)
		imgY, errY := strconv.ParseFloat(sub[3], 64)
		imgW, errW := strconv.ParseFloat(sub[4], 64)
		imgH, errH := strconv.ParseFloat(sub[5], 64)
		if errX != nil || errY != nil || errW != nil || errH != nil {
			return imgTag
		}

		if imgW > 250 || imgH > 250 || imgW < 15 || imgH < 15 {
			return imgTag
		}

		for _, marker := range markers {
			if marker.x >= imgX-80 && marker.x <= imgX+imgW+80 {
				if imgY < marker.y-35 {
					targetCx := marker.x - 15.0
					targetCy := marker.y - 6.0
					newX := targetCx - imgW/2.0
					newY := targetCy - imgH/2.0
					if newY > imgY {
						return fmt.Sprintf(`<image %sx="%.2f" y="%.2f" width="%.2f" height="%.2f"%s>`,
							sub[1], newX, newY, imgW, imgH, sub[6])
					}
				}
			}
		}
		return imgTag
	})
}

func (p *Plugin) findRhwpBinary() (string, error) {
	bundleDir, err := p.API.GetBundlePath()
	if err != nil {
		return "", fmt.Errorf("failed to get bundle path: %w", err)
	}

	binName := "rhwp"
	if runtime.GOOS == "windows" {
		binName = "rhwp.exe"
	}

	// Priority candidates inside the plugin bundle
	candidates := []string{
		filepath.Join(bundleDir, "server", "dist", "bin", fmt.Sprintf("%s_%s", runtime.GOOS, runtime.GOARCH), binName),
		filepath.Join(bundleDir, "server", "dist", "bin", binName),
		filepath.Join(bundleDir, "server", "dist", binName),
		filepath.Join(bundleDir, "server", binName),
		filepath.Join(bundleDir, binName),
	}

	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			os.Chmod(c, 0755)
			return c, nil
		}
	}

	// Fallback to system PATH
	if path, err := exec.LookPath(binName); err == nil {
		return path, nil
	}

	return "", fmt.Errorf("rhwp binary not found for %s_%s in bundle %s", runtime.GOOS, runtime.GOARCH, bundleDir)
}

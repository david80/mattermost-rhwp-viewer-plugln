# Mattermost RHWP Viewer (`mattermost-rhwp-viewer`)

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.2-blue.svg" alt="Version 1.0.2" />
  <img src="https://img.shields.io/badge/Mattermost%20Server->=6.0.0-green.svg" alt="Mattermost 6.0+" />
  <img src="https://img.shields.io/badge/Platform-Linux%20|%20macOS%20|%20Windows-brightgreen.svg" alt="Platforms" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey.svg" alt="License MIT" />
</p>

---

[English](#english) | [한국어](#한국어)

---

<a name="english"></a>
## English

A full-stack (Server + Webapp) Mattermost plugin designed for seamless, high-fidelity viewing of Korean Hangul Word Processor (`.hwp`, `.hwpx`) documents directly inside Mattermost without external services or client-side Office installations.

Powered by **`rhwp`** (Rust-native engine from the Hwp Open Project), this plugin bypasses strict browser Content Security Policies (CSP: `script-src`) through **Server-Side Rendering (SSR)**, converting documents into scalable vector SVGs cached via SHA-256 hashing.

### ✨ Key Features

* **Complete CSP & Security Compliance (SSR Architecture)**:
  * Zero client-side WASM or `eval` execution required.
  * The Go server backend invokes the native `rhwp` engine to render documents directly into SVG pages, eliminating browser sandbox and CSP restrictions.
* **Pixel-Perfect Formatting & Vector Fidelity**:
  * Accurate preservation of tables, cell merges, borders, fonts, paragraph styles, and multi-column layouts.
  * Auto-adjusts official seal/signature alignment `(인)` even when paragraph anchors or rotations (e.g., 270°) are applied.
* **Ultra-Fast Hash Caching**:
  * Rendered pages are cached on the server using SHA-256 file hashes. Subsequent previews load in under 0.1 seconds.
* **Cross-Platform Compatibility**:
  * **Server**: Pre-compiled binaries included for Linux (amd64), macOS (arm64), and Windows (amd64).
  * **Client**: Seamless support across all modern web browsers (Chrome, Firefox, Safari, Edge) and Mattermost Desktop Apps (macOS, Windows, Linux).
* **Robust Desktop App (Electron) Lifecycle**:
  * Utilizes Mattermost's native `onModalDismissed` lifecycle callback to prevent IPC crashes (`TypeError: Object has been destroyed`) and window freezing upon closing.
* **User-Friendly Viewer Interface**:
  * **Zoom Control**: Smooth zoom from 50% to 200% with a single-click 100% reset.
  * **Quick Navigation**: Floating navigation buttons (`⏫ Top`, `▲ Up`, `▼ Down`, `⏬ Bottom`) and custom high-contrast scrollbars.
  * **Direct Download**: High-visibility download button (`⬇️ Download`) for the original file.
  * **Keyboard Support**: Close immediately with the `ESC` key.

---

### 🏛️ Architecture Overview

```
[User clicks .hwp/.hwpx in Mattermost]
                  │
                  ▼
   [Webapp: HwpPreviewModal]
                  │  (GET /api/v1/preview/:file_id)
                  ▼
    [Server: Go Plugin Backend] ──(Cache Hit?)──► [Return Cached SVGs]
                  │ (Cache Miss)
                  ├─► Fetch file via Mattermost API
                  ├─► Compute SHA-256 hash
                  ├─► Invoke native 'rhwp' CLI
                  ├─► Cache vector SVGs to disk
                  └─► Return JSON with SVG pages
                  │
                  ▼
   [Webapp: Render Vector SVGs (Zero WASM / No CSP issues)]
```

---

### 🛠️ Build Requirements

* **Go**: 1.19 or higher
* **Node.js**: 18.x or higher
* **npm**: 9.x or higher
* **System Utilities**: `tar`

---

### 📦 Building the Plugin

To build the entire plugin bundle (Go server cross-compilation + Webapp bundling + tar.gz packaging):

```bash
# Install root and webapp dependencies
npm install
npm --prefix webapp install

# Build everything
npm run build
```

Once the build succeeds, the deployable bundle will be generated at:
```
dist/mattermost-rhwp-viewer-1.0.2.tar.gz
```

Individual build scripts:
* `npm run build:server`: Cross-compiles Go backend for Linux, macOS, and Windows.
* `npm run build:webapp`: Builds production JavaScript bundle with Webpack.
* `npm run bundle`: Packages `plugin.json`, `server/dist`, and `webapp/dist` into a `.tar.gz` archive.

---

### 🚀 Installation & Setup

1. Log in to Mattermost as a System Administrator.
2. Navigate to **System Console > Plugins > Plugin Management**.
3. Under **Upload Plugin**, choose `dist/mattermost-rhwp-viewer-1.0.2.tar.gz` and click **Upload**.
4. In the **Installed Plugins** list, locate **Mattermost RHWP Viewer** and click **Enable**.
5. Refresh your browser or restart the desktop app (`Cmd+Shift+R` or `Ctrl+F5`).
6. Click any `.hwp` or `.hwpx` file attachment in a channel to view the document.

---

### 🔧 Troubleshooting

* **File preview does not trigger**:
  * Hard-refresh your browser (`Ctrl+F5` or `Cmd+Shift+R`) to ensure the updated webapp bundle is loaded.
* **Server binary execution permission (Linux)**:
  * Ensure the Mattermost process has execution permissions for files in `plugins/mattermost-rhwp-viewer/server/dist/bin/linux_amd64/rhwp`.

---

<br/>

---

<a name="한국어"></a>
## 한국어

Mattermost 환경에서 한글 문서(`.hwp`, `.hwpx`)를 외부 클라우드 전송이나 한컴오피스 프로그램 설치 없이, 고품질 벡터 SVG로 사내에서 안전하게 열람할 수 있는 풀스택(Server + Webapp) 플러그인입니다.

HOP(Hwp Open Project)의 핵심 엔진인 **`rhwp` (Rust Native 엔진)**를 서버 백엔드에 통합하여, 브라우저 보안 정책(CSP: `script-src`) 제약을 원천 극복하고 서버단 해시 캐싱을 통해 0.1초대의 빠른 열람 경험을 제공합니다.

### ✨ 주요 기능 및 특징

* **브라우저 CSP(Content Security Policy) 제약 100% 원천 해결 (SSR 아키텍처)**:
  * Mattermost 서버의 엄격한 보안 설정(`script-src`) 환경에서도 브라우저 내 WebAssembly/eval 실행 차단 문제가 전혀 발생하지 않습니다.
  * Go 백엔드 서버가 내장된 `rhwp` 네이티브 엔진을 호출하여 HWP/HWPX를 안전한 벡터 SVG로 변환 후 브라우저에 전달합니다.
* **한컴오피스 수준의 완벽한 서식 재현 및 직인/서명 위치 보정**:
  * 복잡한 표(Table), 셀 병합, 테두리 스타일, 다단, 문단 모양, 글꼴 속성을 충실하게 보존합니다.
  * 문서 하단 직인/서명란`(인)`의 회전이나 문단 앵커 밀림 현상을 감지하여 정확한 위치로 자동 보정합니다.
* **초고속 SHA-256 해시 서버 캐싱**:
  * 한 번 변환된 문서는 파일 고유 해시(SHA-256) 기반으로 서버 디스크에 캐싱되어, 동일 파일 재열람 시 0.1초 만에 즉시 표시됩니다.
* **크로스 플랫폼 지원**:
  * **서버**: Linux(amd64), macOS(arm64), Windows Server(amd64) 실행 바이너리 기본 내장.
  * **클라이언트**: 모든 모던 웹 브라우저(Chrome, Safari, Firefox, Edge) 및 데스크톱 앱(macOS, Windows, Linux) 완벽 지원.
* **Electron 데스크톱 앱 라이프사이클 안정성 보장**:
  * Mattermost 공식 `onModalDismissed` 콜백 규격을 준수하여, 닫기 버튼 클릭 시 Electron IPC 충돌(`TypeError: Object has been destroyed`) 및 화면 멈춤(Freeze) 현상이 발생하지 않습니다.
* **사용자 친화적인 뷰어 UI/UX**:
  * **확대/축소(Zoom)**: 50%부터 200%까지 미세 확대/축소 및 100% 원클릭 리셋.
  * **플로팅 퀵 스크롤**: 화면 우측 하단 네비게이션 패널(`⏫ 맨 위로`, `▲ 위로`, `▼ 아래로`, `⏬ 맨 아래로`) 및 고대비 스크롤바 제공.
  * **원본 다운로드**: 툴바 우측 직관적인 다운로드 버튼(`⬇️ 다운로드`) 제공.
  * **단축키**: `ESC` 키로 간편하게 닫기 가능.

---

### 🏛️ 시스템 구조도

```
[사용자가 채널에서 .hwp/.hwpx 파일 클릭]
                  │
                  ▼
   [Webapp: HwpPreviewModal]
                  │  (GET /api/v1/preview/:file_id)
                  ▼
    [Server: Go 백엔드 플러그인] ──(캐시 존재 여부)──► [캐싱된 SVG 반환]
                  │ (캐시 없음)
                  ├─► Mattermost API로 원본 파일 수신
                  ├─► SHA-256 해시 계산
                  ├─► 내장된 네이티브 'rhwp' CLI 실행
                  ├─► 페이지별 벡터 SVG 생성 및 디스크 캐싱
                  └─► SVG 페이지 배열 JSON 반환
                  │
                  ▼
   [Webapp: 벡터 SVG 화면 렌더링 (클라이언트 WASM/eval 없음, CSP 문제 없음)]
```

---

### 🛠️ 개발 및 빌드 환경

* **Go**: 1.19 이상
* **Node.js**: 18.x 이상
* **npm**: 9.x 이상
* **시스템 유틸리티**: `tar`

---

### 📦 플러그인 빌드 방법

서버 크로스 컴파일, 웹앱 번들링, 최종 배포 아카이브 생성을 한 번에 수행합니다:

```bash
# 루트 및 webapp 의존성 설치
npm install
npm --prefix webapp install

# 전체 패키지 빌드
npm run build
```

빌드가 완료되면 배포용 패키지가 생성됩니다:
```
dist/mattermost-rhwp-viewer-1.0.2.tar.gz
```

개별 빌드 명령어:
* `npm run build:server`: Go 백엔드 서버 바이너리(Linux, macOS, Windows) 크로스 컴파일
* `npm run build:webapp`: Webpack을 이용한 Webapp 프론트엔드 최적화 번들링
* `npm run bundle`: `plugin.json`, `server/dist`, `webapp/dist`를 `.tar.gz`로 묶는 패키징 스크립트

---

### 🚀 설치 및 적용 방법

1. Mattermost 시스템 관리자 계정으로 로그인합니다.
2. **시스템 콘솔 (System Console) > 플러그인 관리 (Plugin Management)** 메뉴로 이동합니다.
3. **플러그인 업로드 (Upload Plugin)** 항목에서 빌드된 `dist/mattermost-rhwp-viewer-1.0.2.tar.gz` 파일을 선택하고 업로드합니다.
4. 설치된 플러그인 목록에서 **Mattermost RHWP Viewer**를 찾아 **활성화 (Enable)**를 클릭합니다.
5. 브라우저 캐시 새로고침(`Cmd+Shift+R` 또는 `Ctrl+F5`)을 진행합니다.
6. 대화방에 업로드된 한글 문서(`.hwp`, `.hwpx`)를 클릭하면 별도 뷰어 프로그램 없이 바로 열람할 수 있습니다.

---

### 🔧 트러블슈팅 및 FAQ

* **문서 클릭 시 기본 다운로드 창만 뜨는 경우**:
  * 브라우저 캐시로 인해 이전 버전 플러그인이 로드되어 있을 수 있습니다. 브라우저 강력 새로고침(`Ctrl+F5` 또는 `Cmd+Shift+R`)을 수행하십시오.
* **Linux 서버에서 변환 오류가 발생하는 경우**:
  * 플러그인 디렉터리 내 바이너리(`server/dist/bin/linux_amd64/rhwp`)의 실행 권한(`chmod +x`)을 확인하십시오.

---

### 📄 License & Credits

* License: [MIT License](LICENSE)
* Core HWP Parsing Engine: Based on [HOP (Hwp Open Project) `rhwp`](https://github.com/hwp-open-project).

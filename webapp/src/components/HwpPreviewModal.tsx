import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FileInfo } from '../types';
import '../styles/viewer.css';

interface HwpPreviewModalProps {
  fileInfo: FileInfo;
  post?: any;
  onClose?: () => void;
  onModalDismissed?: () => void;
  handleClose?: () => void;
  [key: string]: any;
}

const I18N = {
  ko: {
    zoomOut: '축소',
    zoomIn: '확대',
    resetZoom: '100%로 재설정',
    download: '다운로드',
    downloadOriginal: '원본 파일 다운로드',
    close: '닫기 (ESC)',
    closeBtn: '✕ 닫기',
    loading: '한글 문서를 불러오는 중입니다...',
    errorTitle: '문서를 표시할 수 없습니다',
    pageSuffix: '페이지',
    scrollToTop: '맨 위로 이동',
    scrollUp: '위로 스크롤',
    scrollDown: '아래로 스크롤',
    scrollToBottom: '맨 아래로 이동',
    floatingNav: '스크롤 탐색',
    fileNotFound: '파일 정보를 찾을 수 없습니다.',
    renderFailed: '문서 페이지를 렌더링하지 못했습니다.',
    loadFailed: '문서를 불러오지 못했습니다.',
    serverError: (code: number) => `서버 렌더링 실패 (상태 코드: ${code})`,
  },
  en: {
    zoomOut: 'Zoom Out',
    zoomIn: 'Zoom In',
    resetZoom: 'Reset Zoom (100%)',
    download: 'Download',
    downloadOriginal: 'Download Original File',
    close: 'Close (ESC)',
    closeBtn: '✕ Close',
    loading: 'Loading document...',
    errorTitle: 'Unable to display document',
    pageSuffix: 'pages',
    scrollToTop: 'Scroll to Top',
    scrollUp: 'Scroll Up',
    scrollDown: 'Scroll Down',
    scrollToBottom: 'Scroll to Bottom',
    floatingNav: 'Scroll Navigation',
    fileNotFound: 'File information not found.',
    renderFailed: 'Failed to render document pages.',
    loadFailed: 'Failed to load document.',
    serverError: (code: number) => `Server rendering failed (Status: ${code})`,
  },
};

function getLocale(): 'ko' | 'en' {
  try {
    const htmlLang = document.documentElement.lang?.toLowerCase() || '';
    if (htmlLang.startsWith('ko')) return 'ko';
    if (htmlLang.startsWith('en')) return 'en';

    const mmLocale = (
      (window as any).mm_locale ||
      (window as any).clientLocale ||
      (window as any).currentUser?.locale ||
      ''
    ).toLowerCase();
    if (mmLocale.startsWith('ko')) return 'ko';
    if (mmLocale.startsWith('en')) return 'en';

    const navLang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    if (navLang.startsWith('ko')) return 'ko';
    if (navLang.startsWith('en')) return 'en';
  } catch {
    // fallback
  }
  return 'ko';
}

export const HwpPreviewModal: React.FC<HwpPreviewModalProps> = (props) => {
  const { fileInfo } = props;
  const locale = getLocale();
  const t = I18N[locale];

  const [serverPages, setServerPages] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);

  const fileId = fileInfo?.id || (fileInfo as any)?.file_id || '';
  const fileName = fileInfo?.name || (locale === 'en' ? 'document.hwp' : '문서.hwp');
  const ext = (fileInfo?.extension || fileName.split('.').pop() || '').toLowerCase();
  const downloadUrl = (window as any).Client4?.getFileUrl?.(fileId) || `/api/v4/files/${fileId}`;

  // Fetch document preview from server backend (Zero client WASM, Zero CSP restrictions!)
  useEffect(() => {
    let isCancelled = false;

    async function fetchPreview() {
      if (!fileId) {
        setLoading(false);
        setError(t.fileNotFound);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const serverPreviewUrl = `/plugins/mattermost-rhwp-viewer/api/v1/preview/${fileId}`;
        const resp = await fetch(serverPreviewUrl, { credentials: 'include' });
        
        if (!resp.ok) {
          const errData = await resp.json().catch(() => null);
          throw new Error(errData?.error || t.serverError(resp.status));
        }

        const data = await resp.json();
        if (!isCancelled) {
          if (data.pages && data.pages.length > 0) {
            setServerPages(data.pages);
            setPageCount(data.pageCount || data.pages.length);
          } else {
            throw new Error(data.error || t.renderFailed);
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[RHWP] Failed to load document preview:', err);
        if (!isCancelled) {
          setError(err?.message || t.loadFailed);
          setLoading(false);
        }
      }
    }

    fetchPreview();

    return () => {
      isCancelled = true;
    };
  }, [fileId]);

  const handleClose = useCallback(() => {
    // 1. Prioritize Mattermost's official FilePreviewModal callback
    if (typeof props.onModalDismissed === 'function') {
      try {
        props.onModalDismissed();
      } catch (err) {
        console.error('[RHWP] Failed to call onModalDismissed:', err);
      }
    } else if (typeof props.onClose === 'function') {
      try {
        props.onClose();
      } catch (err) {
        console.error('[RHWP] Failed to call onClose:', err);
      }
    } else if (typeof props.handleClose === 'function') {
      try {
        props.handleClose();
      } catch (err) {
        console.error('[RHWP] Failed to call handleClose:', err);
      }
    } else {
      // Fallback: Click only the native modal close button if no callback exists
      const closeBtn = document.querySelector(
        '#closePreviewModal, [data-testid="filePreviewModalClose"], .file-preview-modal__header button:last-child'
      ) as HTMLElement;
      if (closeBtn && typeof closeBtn.click === 'function') {
        try {
          closeBtn.click();
        } catch (err) {
          console.error('[RHWP] Failed to trigger modal close button:', err);
        }
      }
    }

    // Dismiss custom view state
    setIsOpen(false);
  }, [props]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleClose]);

  const scrollByAmount = useCallback((delta: number) => {
    viewportRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  }, []);

  const scrollToEdge = useCallback((position: 'top' | 'bottom') => {
    if (position === 'top') {
      viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const zoomIn = () => setScale((prev) => Math.min(2.0, parseFloat((prev + 0.1).toFixed(1))));
  const zoomOut = () => setScale((prev) => Math.max(0.5, parseFloat((prev - 0.1).toFixed(1))));
  const resetZoom = () => setScale(1.0);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="hwp-modal-overlay">
      {/* Top Toolbar */}
      <header className="hwp-toolbar">
        <div className="hwp-toolbar-left">
          <span className="hwp-file-badge">{ext.toUpperCase()}</span>
          <div className="hwp-file-info">
            <span className="hwp-file-name" title={fileName}>
              {fileName}
            </span>
            <span className="hwp-file-meta">
              {formatFileSize(fileInfo?.size || 0)}
              {pageCount ? ` • ${pageCount} ${t.pageSuffix}` : ''}
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="hwp-toolbar-center">
          <button className="hwp-tool-btn" onClick={zoomOut} title={t.zoomOut} disabled={scale <= 0.5}>
            －
          </button>
          <span
            className="hwp-zoom-label"
            onClick={resetZoom}
            title={t.resetZoom}
            style={{ cursor: 'pointer' }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button className="hwp-tool-btn" onClick={zoomIn} title={t.zoomIn} disabled={scale >= 2.0}>
            ＋
          </button>
        </div>

        {/* Action Buttons */}
        <div className="hwp-toolbar-right">
          <a
            href={`${downloadUrl}?download=1`}
            download={fileName}
            className="hwp-tool-btn hwp-btn-download"
            title={t.downloadOriginal}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: '#ffffff' }}>⬇️</span>
            <span style={{ color: '#ffffff' }}>{t.download}</span>
          </a>
          <button className="hwp-tool-btn hwp-btn-close" onClick={handleClose} title={t.close}>
            {t.closeBtn}
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="hwp-viewport" ref={viewportRef}>
        {loading && (
          <div className="hwp-loading-box">
            <div className="hwp-spinner" />
            <p>{t.loading}</p>
          </div>
        )}

        {error && (
          <div className="hwp-render-error">
            <div className="hwp-error-icon">⚠️</div>
            <p className="hwp-error-title">{t.errorTitle}</p>
            <p className="hwp-error-desc">{error}</p>
            <a
              href={`${downloadUrl}?download=1`}
              download={fileName}
              className="hwp-download-fallback"
            >
              {t.downloadOriginal}
            </a>
          </div>
        )}

        {/* Server-rendered Vector Pages */}
        {!loading && !error && serverPages && (
          <div
            className="hwp-document-wrapper"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
            <div className="rhwp-container">
              {serverPages.map((svg, idx) => (
                <div
                  key={idx}
                  className="rhwp-page"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Quick Scroll Controls */}
      {!loading && !error && (
        <aside className="hwp-floating-scroll-bar" aria-label={t.floatingNav}>
          <button
            type="button"
            className="hwp-floating-btn"
            onClick={() => scrollToEdge('top')}
            title={t.scrollToTop}
          >
            ⏫
          </button>
          <button
            type="button"
            className="hwp-floating-btn"
            onClick={() => scrollByAmount(-500)}
            title={t.scrollUp}
          >
            ▲
          </button>
          <button
            type="button"
            className="hwp-floating-btn"
            onClick={() => scrollByAmount(500)}
            title={t.scrollDown}
          >
            ▼
          </button>
          <button
            type="button"
            className="hwp-floating-btn"
            onClick={() => scrollToEdge('bottom')}
            title={t.scrollToBottom}
          >
            ⏬
          </button>
        </aside>
      )}
    </div>
  );
};

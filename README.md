# Mattermost RHWP Viewer Plugin (`mattermost-rhwp-viewer`)

Mattermost에서 한글 문서(`.hwp`, `.hwpx`)를 외부 전송이나 복잡한 설정 없이 한컴오피스 수준의 고품질 표/벡터 그래픽으로 안전하게 열람할 수 있는 풀스택(Server + Webapp) 플러그인입니다.

HOP(Hwp Open Project)의 공식 핵심 엔진인 **`rhwp` (Rust Native CLI + WASM)**를 탑재하여, 브라우저의 엄격한 보안 정책(CSP: `script-src`) 제약을 원천 극복하고 서버단에서 캐싱된 고성능 벡터 SVG를 즉각 브라우저에 렌더링합니다.

---

## ✨ 주요 특징

* **브라우저 CSP 제약 100% 원천 해결 (방안 A 아키텍처)**:
  * Mattermost 서버의 `script-src` 보안 정책에 상관없이, 서버 Go 백엔드가 내장된 `rhwp` 네이티브 바이너리로 HWP/HWPX를 SVG로 변환하여 전달합니다.
  * 브라우저에서 WebAssembly/eval 실행 차단 문제가 전혀 발생하지 않습니다.
* **크로스 플랫폼 지원 (Linux, macOS, Windows Server & Windows Client)**:
  * 클라이언트 PC에 한컴오피스 설치가 없어도 모든 브라우저 및 데스크톱 앱에서 열람 가능합니다.
  * 서버 역시 Linux(amd64), macOS(arm64), Windows Server(amd64)를 모두 지원합니다.
* **초고속 서버 해시 캐싱**:
  * 한 번 열람된 문서는 SHA-256 해시 기반으로 서버에 SVG가 캐싱되어 다음 열람 시 0.1초 만에 즉시 표시됩니다.
* **완벽한 한컴오피스 서식 재현 및 직인/서명 위치 자동 보정**:
  * 표(Table), 테두리 선, 셀 병합, 글자 모양, 문단 모양, 다단 분할 보존.
  * 표 뒤에 서명이 문단 앵커 또는 회전(270° 등)되어 밀리는 경우, 서명란 `(인)` 위치를 자동 감지하여 정확히 중앙 정렬 보정합니다.
* **뷰어 편의 기능**:
  * 확대 / 축소 (Zoom: 50% ~ 200%) 및 100% 원클릭 리셋.
  * 뚜렷한 고대비 커스텀 스크롤바 & 우측 하단 플로팅 퀵 스크롤 패널 (`⏫ 맨 위로`, `▲ 위로`, `▼ 아래로`, `⏬ 맨 아래로`).
  * 원본 고대비 다운로드 버튼 (`⬇️ 다운로드`).
  * `ESC` 키로 모달 닫기.

---

## 📦 플러그인 빌드

```bash
# 전체 빌드 (Go 서버 크로스컴파일 + Webapp 번들링 + 패키징)
npm run build
```

빌드가 완료되면 다음 파일이 생성됩니다:
`dist/mattermost-rhwp-viewer-1.0.2.tar.gz`

---

## 🚀 설치 및 사용법

1. Mattermost **시스템 콘솔 (System Console) > 플러그인 관리 (Plugin Management)**로 이동합니다.
2. `Upload Plugin`에서 **`dist/mattermost-rhwp-viewer-1.0.2.tar.gz`**를 선택하고 업로드합니다.
3. 플러그인 목록에서 **Mattermost RHWP Viewer**를 찾아 **활성화 (Enable)**합니다.
4. 브라우저에서 강력 새로고침(`Cmd+Shift+R` 또는 `Ctrl+F5`) 후 채팅방의 HWP/HWPX 파일을 클릭하면 고품질 서식으로 즉시 열람할 수 있습니다.

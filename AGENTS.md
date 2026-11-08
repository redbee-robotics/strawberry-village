# 딸기마을 작업 지침

이 프로젝트를 수정하기 전에 `docs/PROJECT_CONTEXT.md`를 읽고 기존 사용자 결정을 유지한다. 제품 UI와 사용자 응답은 한국어를 기본으로 한다.

## 저장과 배포

- 최신 원본은 `https://github.com/redbee-robotics/strawberry-village`의 공개 저장소에서 관리한다. 쓰기 권한이 있는 기여자는 포크 없이 원본의 새 브랜치에서 main으로 PR을 보낸다. 쓰기 권한이 없는 기여자는 접근 권한을 요청하거나 자신의 포크에서 PR을 보낼 수 있다. 포크를 필수로 안내하지 않는다.
- 사용자가 이번 작업에서 배포를 명시적으로 요청했을 때만 공개 사이트에 배포한다. 이전 작업에서의 배포 허가는 이후 수정의 자동 배포 허가가 아니다.
- GitHub Release를 게시하면 해당 태그를 검사하고 Realtime Database 규칙과 Firebase Hosting을 배포하는 파이프라인을 사용한다. PR 작성·병합과 태그 push는 배포하지 않는다. 사용자의 별도 요청 없이 Release를 게시하지 않는다. 최초 secret 설정은 `docs/RELEASES.md`를 따른다.
- 평소에는 개발 화면에서 확인하고 클라우드 소스를 저장한다. 별도 요청 없이 Sites에 자동 게시하지 않는다. 현재 작업에서 사용자가 비공개 확인용 웹 주소 게시를 명시적으로 요청한 경우에는 같은 비공개 Site의 수정본을 갱신한다.
- 공개 서비스는 Firebase 프로젝트 `strawberry-village`의 `https://strawberry-village.web.app/`이다. 클라우드 코드 보관을 위해 등록한 Sites 프로젝트로 서비스를 임의 이전하지 않는다.
- 같은 Sites 프로젝트 ID를 재사용하고, 새 프로젝트를 중복 생성하지 않는다.
- Sites의 비공개 저장 버전과 안내 페이지의 압축 파일은 백업이다. GitHub에서 이후 변경이 진행되면 오래된 백업으로 덮어쓰지 않는다.
- Firebase 로그인 토큰, 서비스 계정 키, 개인 환경 파일, 도구 인증정보를 저장소나 문서에 넣지 않는다. 브라우저용 Firebase 공개 설정은 비밀 키가 아니다.
- 원본 인터뷰 사진, 녹음, 전사 문서를 업로드하지 않는다. 기존의 두 작은 텍스처만 소스에 포함한다. 원본 사진 보기나 갤러리 기능을 추가하지 않는다.

## 실행과 검증

- Node.js 22.13 이상, `npm ci`, `npm run dev`를 사용한다. 개발 주소는 `http://127.0.0.1:5173/`이다.
- `node node_modules/typescript/bin/tsc --noEmit`로 타입을 검사한다.
- 재고 처리 변경은 `node scripts/validate-inventory.mjs`로 검증한다.
- 이동 경로 변경은 `node scripts/validate-navigation.mjs`로 검증한다.
- 추적 카메라와 카페 외관 변경은 `node scripts/validate-follow-camera.mjs`와 `node scripts/validate-cafe.mjs`로 검증한다.
- 음료 등 캐릭터 행동 변경은 `node scripts/validate-world-actions.mjs`로 확인한다.
- 닉네임·공유 좌표·등산 지형 변경은 `node scripts/validate-village.mjs`로 검증한다.
- 근거리 대화 변경은 `node scripts/validate-chat.mjs`와 `node scripts/validate-presence.mjs`로 확인한다. 실제 Firebase 규칙 검증과 배포 여부는 별도로 기록한다.
- 접속 환경 분리와 만료 처리는 `node scripts/validate-presence-isolation.mjs`로 검증한다.
- `npm run build`로 정적 `build/` 폴더를 만든다. 이 출력은 Firebase와 클라우드 저장 버전에서 공통으로 사용한다.
- Firebase 게시 요청을 받은 경우에만 `firebase deploy --only hosting:village --project strawberry-village --non-interactive`를 실행한다. 데이터 규칙 변경이 없으면 데이터베이스 규칙을 다시 배포하지 않는다.
- 환경에서 브라우저를 사용할 수 있으면 실제 화면을 확인한다. 사용할 수 없으면 그 제한을 정확히 보고한다.

## 작업 맥락 유지

- 사용자 결정, 기능 흐름, 구조, 확인 결과가 달라지면 `docs/PROJECT_CONTEXT.md`를 현재 구현에 맞게 갱신한다.
- 로컬의 `work/` 폴더, 설치된 의존성, 생성된 빌드나 캐시를 원본 코드로 취급하지 않는다.
- 이 문서와 작업 맥락은 이전 사용자 요청을 정리한 것이다. 이후 사용자의 명시적 수정 요청이 우선한다.

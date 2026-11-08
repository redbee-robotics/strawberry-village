# 딸기마을

논밭, 딸기 하우스 네 동, 딸기 선별장, 딸기 카페가 있는 온라인 3D 농장입니다.

공개 주소: https://strawberry-village.web.app
Firebase 프로젝트: strawberry-village

원본 저장소: https://github.com/redbee-robotics/strawberry-village

저장소의 쓰기 권한이 있으면 포크 없이 새 브랜치에서 PR을 보낼 수 있습니다. 쓰기 권한이 없는 참여자는 접근 권한을 요청하거나 자신의 포크에서 PR을 보낼 수 있습니다. 실행 방법과 절차는 [기여 안내](CONTRIBUTING.md)를 참고해 주세요.

## 조작

- 화면을 클릭하거나 터치한 곳으로 걷습니다. 방향키로도 걸을 수 있습니다.
- 좌클릭 + 드래그: 화면 회전
- 우클릭 + 드래그: 화면 이동
- 마우스 휠: 확대/축소
- 장소 이름표를 눌러도 해당 장소로 이동합니다. 마을 지도는 상단 버튼으로 펼칠 수 있습니다.
- 논밭 안에도 걸어 들어갈 수 있습니다.

## 농장 생활

- 딸기 베드 가까이에서만 물 주기와 수확을 할 수 있습니다.
- 베드 근처에서 5번으로 잎과 꽃, 열매를 살펴보고 다시 돌아올 수 있습니다.
- 수확한 낱알은 바구니에 들어갑니다.
- 딸기 선별장에 직접 들어가면 별도의 작업 화면이 열립니다.
- 바구니의 딸기 네 알을 골라 선별 완료하면 포장된 1팩이 가방에 들어갑니다.
- 딸기 카페에 직접 걸어 들어가 점원에게 음료를 주문할 수 있습니다.
- 카페, 선별장, 각 하우스에 들어가면 해당 공간의 독립된 3D 실내 화면으로 전환됩니다.
- 의자 근처에서 앉기, 평상 근처에서 눕기가 나타납니다. 이동키를 누르면 일어납니다.
- 돌아다니는 NPC는 없습니다. 카페 점원 외에는 실제 접속 세션만 표시합니다.
- 안내 알림은 약 4초 후 사라집니다.
- 날씨는 Open-Meteo의 현재 날씨 자료와 연동하며, 화면에는 위치명을 표시하지 않습니다.

## 동시 접속

Firebase 익명 인증으로 방문자별 접근을 구분합니다. Realtime Database에서 캐릭터 이름, 위치, 행동, 바구니 수량을 동기화합니다. 각 방문자는 자신의 접속 상태만 쓸 수 있고, 연결 해제 시 해당 상태가 제거됩니다. 수확과 포장 기록은 현재 브라우저에 저장됩니다.

운영 마을과 개발·미리보기 마을은 접속 인원과 캐릭터를 별도로 공유합니다. 30초 이상 갱신되지 않은 접속 상태는 표시하지 않습니다. 이 분리 기능을 처음 적용할 때는 [접속자 경로 전환 절차](docs/RELEASES.md#접속자-경로-전환)에 따라 데이터베이스 규칙도 배포해야 합니다.

## 개발과 배포

Node.js 22.13 이상에서 npm ci, npm run dev를 사용합니다. Windows, macOS, Linux에서 같은 명령으로 실행할 수 있습니다.

다른 기기나 Dot에서 이어서 작업할 때는 이 GitHub 저장소의 최신 코드를 열고 AGENTS.md와 docs/PROJECT_CONTEXT.md를 먼저 읽습니다. 공개 서비스는 Firebase Hosting을 계속 사용합니다. 앞서 저장한 비공개 클라우드 버전은 백업입니다.

검증: node node_modules/typescript/bin/tsc --noEmit
재고 검증: node scripts/validate-inventory.mjs
이동 검증: node scripts/validate-navigation.mjs
빌드: npm run build
배포: firebase deploy --only hosting:village --project strawberry-village
접속 규칙 배포: firebase deploy --only database:village --project strawberry-village

빌드는 build 폴더에 생성됩니다. Firebase Hosting에는 이 폴더만 배포합니다. 공개 웹 설정에는 비밀 인증정보가 없으며, 접근 제어는 Firebase 인증과 database.rules.json에서 처리합니다.

평소 수정은 로컬 화면에서 확인합니다. GitHub Release를 게시하면 해당 태그를 검사하고 빌드한 뒤 Firebase Hosting에 자동 배포합니다. 최초 secret 설정과 배포 절차는 [Release 배포 안내](docs/RELEASES.md)를 참고하세요. PR 작성이나 병합만으로 배포하지 않습니다.

Firebase 로그인 정보는 소스에 포함하지 않습니다. 새로운 작업 환경에서 배포할 때는 해당 Firebase 프로젝트에 접근 가능한 계정으로 별도 로그인해야 합니다.

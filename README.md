# 딸기마을

캐릭터를 따라가는 가까운 3인칭 시점의 논밭, 딸기 하우스, 딸기 선별장, 딸기 카페가 있는 온라인 3D 농장입니다.

공개 주소: https://strawberry-village.web.app
Firebase 프로젝트: strawberry-village

원본 저장소: https://github.com/redbee-robotics/strawberry-village

저장소의 쓰기 권한이 있으면 포크 없이 새 브랜치에서 PR을 보낼 수 있습니다. 쓰기 권한이 없는 참여자는 접근 권한을 요청하거나 자신의 포크에서 PR을 보낼 수 있습니다. 실행 방법과 절차는 [기여 안내](CONTRIBUTING.md)를 참고해 주세요.

## 조작

- 화면을 클릭하거나 터치한 곳으로 걷습니다. 방향키로도 걸을 수 있습니다.
- 스페이스바로 점프합니다. 넓어진 마을 뒤편의 산책길을 따라 뒷산 정상까지 걸어갈 수 있습니다.
- 좌클릭 + 드래그: 화면 이동
- 우클릭 + 드래그: 화면 회전
- 마우스 휠: 확대/축소
- 모바일: 한 손가락 드래그로 화면 이동, 두 손가락 드래그로 회전, 핀치로 확대/축소
- 확대·축소 버튼은 기본으로 숨기며 설정에서 표시할 수 있습니다.
- 장소 이름표를 눌러도 해당 장소로 이동합니다. 왼쪽 아래의 마을 지도를 펼치거나 최소화할 수 있습니다.
- 논밭 안에도 걸어 들어갈 수 있습니다. 바깥 논밭과 하우스, 농로를 추가했으며 하우스는 앞뒤 문으로 출입합니다.

## 농장 생활

- 하우스 안에서 베드 가까이에 있을 때만 물 주기와 수확을 할 수 있습니다.
- 베드 근처에서 잎과 꽃, 열매를 살펴볼 수 있습니다. 행동 번호와 숫자키는 화면에 보이는 버튼 순서를 따릅니다.
- 수확한 낱알은 바구니에 들어갑니다.
- 딸기 선별장에 직접 들어가면 별도의 작업 화면이 열립니다.
- 바구니의 딸기 12알을 골라 선별 완료하면 포장된 1팩이 가방에 들어갑니다.
- 선별장에서는 마우스나 터치로 딸기를 끌어 팩에 담고, 칸을 바꾸거나 바구니로 되돌릴 수 있습니다.
- 딸기 카페에 직접 걸어 들어가 점원에게 음료를 주문할 수 있습니다.
- 주문 재고는 바구니와 가방을 합산합니다. 팩이 필요하면 내용물 수대로 열어 쓰고 남은 딸기는 바구니에 넣습니다. 기존 4알 팩과 새 12알 팩을 함께 사용할 수 있습니다.
- 카페, 선별장, 각 하우스에 들어가면 해당 공간의 독립된 3D 실내 화면으로 전환됩니다.
- 의자 근처에서 앉기, 평상 근처에서 눕기가 나타납니다. 이동키를 누르면 일어납니다.
- 돌아다니는 NPC는 없습니다. 카페 점원 외에는 실제 접속 세션만 표시합니다.
- 안내 알림은 약 4초 후 사라집니다.
- 마지막 위치와 방향, 실내 공간, 시야를 저장해 새로고침 후에도 이어서 시작합니다.
- 설정에서 닉네임을 바꿀 수 있고, 중복된 이름은 거부하고 다른 이름을 제안합니다. 자동 이름에는 숫자를 붙이지 않습니다.
- 가까운 방문자가 있으면 하단에 말 걸기가 나타납니다. 같은 공간의 주변 이웃에게 말풍선으로 이야기하며, 여러 사람이 함께 대화할 수 있습니다.
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
마을 검증: node scripts/validate-village.mjs
대화 검증: node scripts/validate-chat.mjs
접속·말풍선 모의 통합 검사: node scripts/validate-presence.mjs

접속 환경·만료 검사: node scripts/validate-presence-isolation.mjs
빌드: npm run build
배포: firebase deploy --only hosting:village --project strawberry-village
접속 규칙 배포: firebase deploy --only database:village --project strawberry-village

빌드는 build 폴더에 생성됩니다. Firebase Hosting에는 이 폴더만 배포합니다. 공개 웹 설정에는 비밀 인증정보가 없으며, 접근 제어는 Firebase 인증과 database.rules.json에서 처리합니다.

평소 수정은 로컬 화면에서 확인합니다. GitHub Release를 게시하면 해당 태그를 검사하고 빌드한 뒤 Realtime Database 규칙과 Firebase Hosting에 자동 배포합니다. 최초 secret 설정과 배포 절차는 [Release 배포 안내](docs/RELEASES.md)를 참고하세요. PR 작성이나 병합만으로 배포하지 않습니다.

Firebase 로그인 정보는 소스에 포함하지 않습니다. 새로운 작업 환경에서 배포할 때는 해당 Firebase 프로젝트에 접근 가능한 계정으로 별도 로그인해야 합니다.

주변 대화에는 새 `village/environments/$environment/speech` 데이터베이스 규칙 배포가 필요합니다. 정적 사이트만 게시한 상태에서는 대화 전송을 사용할 수 없습니다. 배포 전 확인 사항은 [Release 안내](docs/RELEASES.md)를 참고하세요.

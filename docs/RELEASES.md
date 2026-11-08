# GitHub Release로 배포하기

`.github/workflows/release.yml`은 GitHub Release를 **Publish release**로 게시하면 실행됩니다. 해당 Release의 태그를 체크아웃한 뒤 의존성 설치, 타입 검사, 재고·이동 경로 검사, 정적 빌드를 거쳐 Firebase Hosting `village`에 배포합니다.

배포 주소는 https://strawberry-village.web.app/ 입니다. PR 작성, PR 병합, 태그 push, Release 초안 저장만으로는 배포하지 않습니다. 게시한 사전 출시(Pre-release)도 배포합니다. 데이터베이스 규칙은 이 워크플로에서 배포하지 않습니다.

## 최초 인증 설정

저장소 관리자가 한 번 설정합니다.

1. Firebase 프로젝트 `strawberry-village`의 GitHub Actions 전용 서비스 계정을 준비합니다. 프로젝트에 **Firebase Hosting Admin**(`roles/firebasehosting.admin`)과 **Service Usage Consumer**(`roles/serviceusage.serviceUsageConsumer`) 권한을 부여합니다.
2. 해당 서비스 계정의 JSON 키를 GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret**에 `FIREBASE_SERVICE_ACCOUNT_STRAWBERRY_VILLAGE`라는 이름으로 등록합니다. JSON 전체를 secret 값으로 넣습니다.
3. 키 파일과 로그인 토큰을 소스, PR, 문서에 넣지 않습니다. 이 저장소에는 secret을 참조하는 워크플로만 포함합니다.

secret이 없으면 배포 단계가 원인을 표시하고 종료합니다. 이 문서는 인증 설정 방법이며, 실제 secret 등록이나 배포가 완료되었다는 의미가 아닙니다.

## 새 버전 배포

1. 변경 PR을 `main`에 병합합니다.
2. GitHub의 **Releases → Draft a new release**에서 배포할 커밋에 새 태그(예: `v0.2.0`)를 지정합니다. 워크플로가 포함된 커밋을 선택합니다.
3. 변경 내용을 적고 **Publish release**를 누릅니다.
4. **Actions → Release to Firebase Hosting**에서 검사와 배포 성공을 확인한 뒤 공개 사이트를 확인합니다.

실행 중인 배포를 새 Release 때문에 중단하지 않도록 동시 실행을 제한합니다. 인증을 수정한 뒤에는 실패한 실행의 **Re-run failed jobs**로 같은 태그를 다시 배포할 수 있습니다.

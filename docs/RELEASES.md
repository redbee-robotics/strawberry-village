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

## 접속자 경로 전환

운영과 개발 접속자는 각각 `village/environments/production/players`, `village/environments/development/players`에 저장합니다. 공개 운영 호스트 두 개 외의 개발·미리보기 주소는 개발 경로를 사용합니다. 이전 공용 경로 `village/players`의 데이터는 새 화면에 표시하지 않습니다.

이 변경의 최초 운영 적용에는 Firebase Realtime Database 관리 권한이 있는 인증이 필요합니다. Hosting 배포 전용 서비스 계정만으로는 규칙 배포나 데이터 삭제를 할 수 없습니다. 운영 적용 요청을 받은 관리자는 다음 순서로 진행합니다.

1. 새 규칙을 먼저 배포합니다. 이전 버전의 열린 탭은 공용 경로에 접근할 수 없게 되므로 마을을 새로고침해야 합니다.

   ```sh
   firebase deploy --only database:village --project strawberry-village --non-interactive
   ```

2. 이전 공용 경로의 접속 상태를 삭제합니다. 이 명령은 캐릭터의 일시적 접속 상태만 지우며 새 환경별 경로나 브라우저의 수확·포장 재고는 건드리지 않습니다.

   ```sh
   firebase database:remove /village/players --instance strawberry-village-default-rtdb --project strawberry-village --force --non-interactive
   ```

3. 새 버전을 Hosting에 배포하고 공개 마을을 새로고침합니다. GitHub Release 배포는 위 절차대로 별도 요청이 있을 때 게시합니다.
4. 운영 탭과 개발 탭을 함께 열어도 각 환경의 접속 인원과 캐릭터가 섞이지 않는지 확인합니다. 확인용 탭은 닫아 접속 상태를 남기지 않습니다.

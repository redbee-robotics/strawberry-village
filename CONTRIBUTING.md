# 딸기마을에 기여하기

저장소의 쓰기 권한이 있으면 **포크 없이 원본 저장소의 새 브랜치에서 PR을 보낼 수 있습니다.** Firebase 관리자 권한은 필요하지 않습니다.

## 시작하기

1. 원본 저장소를 내려받고 변경을 위한 새 브랜치를 만듭니다.

```sh
git clone https://github.com/redbee-robotics/strawberry-village.git
cd strawberry-village
git switch -c my-change
```

2. `AGENTS.md`와 `docs/PROJECT_CONTEXT.md`에서 현재 동작과 사용자 결정을 확인합니다.
3. Node.js 22.13 이상에서 다음 명령으로 실행합니다.

```sh
npm ci
npm run dev
```

개발 주소는 `http://127.0.0.1:5173/`입니다. 공개 사이트의 Firebase 로그인 정보가 없어도 코드와 화면을 로컬에서 수정하고 빌드할 수 있습니다.

## 확인하기

코드 변경 시 관련 검사를 실행하고 PR에 결과를 적어 주세요.

```sh
node node_modules/typescript/bin/tsc --noEmit
node scripts/validate-inventory.mjs
node scripts/validate-navigation.mjs
npm run build
```

화면을 변경했다면 데스크톱과 모바일 크기에서 확인한 결과나 화면을 첨부해 주세요. 문서만 수정한 경우에는 해당 내용을 읽어 확인한 결과를 적으면 됩니다.

## PR 보내기

변경 사항을 커밋한 뒤 자신의 작업 브랜치를 원본 저장소에 올립니다.

```sh
git push -u origin my-change
```

GitHub의 **Pull requests → New pull request**에서 base를 `main`, compare를 작업 브랜치로 선택합니다. 바뀐 동작, 변경 이유와 확인 결과를 설명해 주세요. 같은 저장소 안의 브랜치를 사용하므로 포크는 필요하지 않습니다.

## 쓰기 권한이 없는 경우

포크 없이 참여하려면 관리자에게 GitHub 아이디나 소속 팀을 알려 이 저장소의 쓰기 권한을 요청해 주세요. GitHub는 불특정 다수 전체에게 포크 없는 PR만 허용하는 설정을 제공하지 않습니다. [브랜치와 포크에 관한 GitHub 안내](https://docs.github.com/en/pull-requests/concepts/writing-code-for-a-project)를 참고해 주세요.

권한을 추가하지 않고도 참여할 수 있습니다. 저장소를 자신의 계정으로 포크하고 그곳의 작업 브랜치에서 원본 `main`을 대상으로 PR을 보내면 됩니다.

## 변경 범위와 배포

작은 범위의 변경은 하나의 PR로 묶어 주세요. 큰 기능이나 기존 조작 방식의 변경은 먼저 이슈에서 방향을 이야기할 수 있습니다.

원본 인터뷰 사진과 녹음, 전사 자료, 로그인 토큰, 서비스 계정 키, 개인 환경 파일은 포함하지 않습니다. 기존의 작은 텍스처 두 개는 프로젝트에 이미 포함되어 있습니다.

PR을 보내거나 병합하는 것만으로 공개 농장이 배포되지는 않습니다. 관리자가 GitHub Release를 게시하면 해당 태그의 검사와 빌드가 성공한 뒤 Firebase Hosting에 자동 배포합니다. 최초 인증 설정과 절차는 [Release 배포 안내](docs/RELEASES.md)를 참고해 주세요.

# 딸기마을에 기여하기

작은 범위의 변경은 하나의 PR로 묶어 주세요. 큰 기능이나 조작 방식의 변경은 먼저 이슈에서 방향을 이야기할 수 있습니다.

## 시작하기

Node.js 22.13 이상을 사용합니다.

```sh
git clone https://github.com/redbee-robotics/strawberry-village.git
cd strawberry-village
git switch -c my-change
npm ci
npm run dev
```

개발 주소는 `http://127.0.0.1:5173/`입니다. 작업 전 `AGENTS.md`를 확인해 주세요.

## 확인하기

코드를 변경했다면 타입 검사와 빌드, 변경한 기능에 해당하는 검사를 실행합니다.

```sh
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

기능별 검사는 `scripts/validate-*.mjs`에 있습니다. 화면 변경은 데스크톱과 모바일에서 확인하고, PR에 변경 이유와 확인 결과를 적어 주세요. 문서만 수정했다면 내용과 링크를 확인하면 됩니다.

## PR 보내기

저장소에 쓰기 권한이 있으면 포크 없이 원본의 작업 브랜치에서 `main`으로 PR을 보냅니다. 쓰기 권한이 없으면 자신의 포크에서 PR을 보낼 수 있습니다.

개인정보, 인증 정보, 비공개 자료, 로컬 환경 파일과 생성된 빌드는 커밋하지 않습니다. 공개 이슈나 PR에는 실제 인증 값이나 다른 이용자의 정보를 포함하지 마세요.

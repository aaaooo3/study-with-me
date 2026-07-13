# 기록원 지침 퀴즈

국가기록원 지침(기록물관리 지침, 처리과 표준 등)을 직접 문제로 등록해두고,
OX/객관식/빈칸채우기 퀴즈로 반복해서 풀며 암기하는 개인용 학습 앱입니다.
휴대폰 홈 화면에 앱처럼 설치해서 아무 때나 꺼내 쓸 수 있습니다 (PWA).

## 사용 방법

1. **카테고리 만들기**: 지침 이름(예: "기록물관리 지침")으로 카테고리를 만듭니다.
2. **문제 등록**: 지침 내용을 보면서 OX/객관식/빈칸채우기 문제를 직접 입력합니다.
   해설을 같이 적어두면 복습할 때 도움이 됩니다.
3. **퀴즈 풀기**: 카테고리별로 풀거나, 전체 문제를 랜덤으로 섞어서 풉니다.
   틀린 문제만 모아서 다시 풀 수도 있습니다.
4. **백업**: 관리 화면에서 데이터를 JSON으로 내보내고, 다른 기기에서 가져올 수 있습니다.

모든 데이터는 브라우저 localStorage에만 저장되며, 서버로 전송되지 않습니다.

## 개발

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build   # dist/ 에 정적 파일 생성
npm run preview # 빌드 결과 미리보기
```

아이콘을 다시 만들어야 하면:

```bash
node scripts/generate-icons.mjs
```

## 폰에 설치하기 (PWA)

1. 배포된 URL을 폰 브라우저(Safari/Chrome)로 엽니다.
2. **공유 → 홈 화면에 추가** (iOS) 또는 **메뉴 → 앱 설치/홈 화면에 추가** (Android)를 누릅니다.
3. 홈 화면 아이콘으로 오프라인에서도 실행됩니다.

## 배포 (GitHub Pages)

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 자동으로 빌드해서
GitHub Pages에 배포합니다. 저장소 **Settings → Pages → Source**를 "GitHub Actions"로
설정해야 합니다. 저장소가 비공개(private)라면 GitHub Pages도 접근 권한이 있는
계정만 볼 수 있습니다 (Pro/Team 플랜 필요).

배포 URL은 보통 `https://<username>.github.io/study-with-me/` 형태입니다.

# 코스트코 고척점 이번 주 할인

코스트코 코리아 웹사이트의 ‘스페셜 할인’ 목록을 고척점에서 확인하기 좋게 정리한 모바일 페이지입니다.

- 페이지: `index.html` (빌드 없음, `data.json`을 읽어서 표시)
- 데이터: `scripts/fetch.mjs`가 코스트코 사이트에서 할인 상품과 고척점 영업시간·휴무일을 받아 `data.json`에 저장
- 자동 갱신: GitHub Actions(`.github/workflows/update.yml`)가 매일 오전 6시(한국 시간)에 실행하고, 바뀐 게 있을 때만 커밋
- 제외: 온라인 전용 표시가 붙은 상품, 사업자용 대량 묶음(200만 원 이상이면서 ‘X 수백 개’ 같은 묶음)

> 온라인 할인 목록 기준이라 고척점 재고나 매장 가격은 다를 수 있습니다.

## 직접 갱신하기

```bash
node scripts/fetch.mjs
git add data.json
git commit -m "할인 목록 갱신"
git push
```

GitHub 저장소의 **Actions → 할인 목록 갱신 → Run workflow**로도 바로 실행할 수 있습니다.

# GMI Cloud 試點叢集營運儀表板

這是單一 GPU 叢集與 vLLM 部署的唯讀展示介面原型。畫面只使用程式庫中的**合成模擬資料**，沒有連線到任何客戶、叢集、指標或告警服務。

## 公開預覽

此儲存庫以 GitHub Pages 發布靜態網站，並在 `main` 分支更新時自動重新部署。公開頁面只包含前端靜態檔案；本機 Next.js 的 `/api/demo/dashboard` 路由不是 GitHub Pages 執行中的 API，也不提供客戶資料。

## 開發

```bash
cd next-app
npm ci
npm run dev
```

驗證程式碼並建置靜態輸出：

```bash
cd next-app
npm run typecheck
npm run build
```

靜態輸出位於 `next-app/out/`。GitHub Pages 工作流程會在發布前排除 `/api/` 輸出；Dashboard 直接匯入 `src/lib/mock-data.ts` 中明確標示的合成 fixture。

## 專案內容

- `next-app/`：Next.js App Router、TypeScript 與 Dashboard 原始碼。
- `docs/`：MVP 規格、工程待辦與逐項驗收規劃草案；不是已上線 API 或通過驗收的聲明。
- `preview/`：獨立單檔 HTML 展示原型。

接入真實遙測資料前，必須先設計並驗證伺服器端身分驗證、逐資源授權、資料來源與核定的 SLO。不得把瀏覽器直接連到 Prometheus 或 GPU 節點，也不可用模擬資料冒充客戶實際狀況。

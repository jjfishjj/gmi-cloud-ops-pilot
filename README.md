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

靜態輸出位於 `next-app/out/`。GitHub Pages 工作流程會在發布前排除 `/api/` 輸出；Dashboard 預設直接匯入 `src/lib/mock-data.ts` 中明確標示的合成 fixture。

## 三項導入工作流程

- **資料接線準備：**六項盤點勾選只存在使用者目前瀏覽器的 localStorage，可下載只包含勾選狀態的 JSON 摘要；共用裝置可清除勾選。
- **導入前諮詢：**通用提綱可複製或下載成文字檔。此靜態網站沒有諮詢收件或後端保存功能。
- **導入後分析：**可在瀏覽器本機讀取最多 5 MB、50,000 列的 canonical metrics CSV，或下載內建合成範例；支援指標名稱列於分析區格式說明。必填欄位為 `timestamp,metric,value`，時間需含時區。CSV 不會上傳或保存，離開／重新整理即清除分析結果；平均／最小／最大是匯入列的描述統計，不等同自動叢集聚合、告警、根因診斷或 SLO 判定。

以上不代表已有 Prometheus／客戶資料接線。正式接線仍須先確認 pilot API、伺服器端驗證與 RBAC、指標映射和核定 SLO；不可將資料源憑證放入靜態前端。

## 專案內容

- `next-app/`：Next.js App Router、TypeScript 與 Dashboard 原始碼。
- `docs/`：MVP 規格、工程待辦與逐項驗收規劃草案；不是已上線 API 或通過驗收的聲明。
- `preview/`：獨立單檔 HTML 展示原型。

接入真實遙測資料前，必須先設計並驗證伺服器端身分驗證、逐資源授權、資料來源與核定的 SLO。不得把瀏覽器直接連到 Prometheus 或 GPU 節點，也不可用模擬資料冒充客戶實際狀況。

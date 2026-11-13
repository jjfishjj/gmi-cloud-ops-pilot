# GMI Cloud 試點叢集營運儀表板

這是 Next.js App Router、React、TypeScript、Tailwind CSS v4 與 Shadcn UI 基礎元件的深色展示原型，範圍限定為一個客戶、一個 GPU 叢集、一個 vLLM 部署，僅提供唯讀觀測。

## 本機執行

```bash
npm ci
npm run dev
```

```bash
npm run typecheck
npm run build
```

## 資料界線

`src/lib/mock-data.ts` 中的全部數值皆為合成 fixture，僅供介面預覽。尚未連接任何客戶、GPU 叢集、vLLM endpoint、指標儲存層、告警來源或 SSO/RBAC 服務。`src/lib/data-source.ts` 僅記錄提案中的唯讀 BFF 契約，刻意不實作 fetch；瀏覽器不得直接連接 Prometheus 或 GPU 節點。

本機 Next.js 提供 `GET /api/demo/dashboard`，只回傳相同的合成 fixture 與 `mode: simulated` metadata；非 GET 方法由框架回應 405。這不是正式 BFF，尚未實作正式身份驗證或授權，不得直接替換成客戶資料。公開的臨時預覽只部署 `preview/index.html`，不包含這個 demo endpoint。

`next.config.ts` 使用 `output: "export"` 輸出靜態網站到 `out/`。GitHub Actions 發布時會為 Pages 專案網址設定 base path，並移除 `/api/` 輸出。**GitHub Pages 只託管靜態檔案，不會執行這個 API route**；公開 Dashboard 直接使用並清楚標示的合成 fixture。

接線前須先確認試點 customer/cluster/deployment ID、授權模型、實際 DCGM Exporter 與 vLLM metric mapping、採集 cadence、告警來源與 owner、runbook，以及客戶核定的 SLO/門檻。缺值必須顯示「未提供」，不可補零；SLO 未設定時不得標成 SLA 違規。告警介面不提供 ack、resolve、assign 或任何叢集變更操作。

## 目錄

- `src/app/`：App Router 入口與深色介面樣式。
- `src/app/api/demo/dashboard/route.ts`：僅供本機的合成資料唯讀 GET 示範路由。
- `src/components/dashboard.tsx`：單一試點叢集 Dashboard。
- `src/components/ui/button.tsx`：Shadcn UI Button primitive。
- `src/lib/mock-data.ts`：明確標示為模擬的型別化 fixture。
- `src/lib/data-source.ts`：尚未接線的唯讀資料契約。
- `../preview/index.html`：獨立單檔 HTML 展示原型。
- `../docs/`：既有 MVP 提案、工程待辦與驗收任務；這些是計畫，不代表已有正式 API 或驗收通過。

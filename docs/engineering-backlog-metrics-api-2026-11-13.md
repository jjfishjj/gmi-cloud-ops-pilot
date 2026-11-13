# GMI Cloud AI 叢集營運儀表板｜工程待辦

> 狀態：規劃草案（由 MVP 規格拆分，尚未代表工程估點、客戶承諾或正式 API 設計）  
> 依據：[MVP 規格與 Metrics / API 清單](./MVP-spec-metrics-api-2026-11-13.md)

## 範圍與工作原則

本 backlog 僅涵蓋一個 pilot 企業客戶、一個 GPU 叢集、一個 vLLM deployment，以及 GPU 健康、推理效能和唯讀告警。現有 dashboard 是 mock-data 原型；接線完成前須明確標示或移除模擬資料，不能讓 mock 看起來像真實客戶遙測。

規格中的 `/api/v1` 路徑、欄位、輪詢頻率與效能數字均是提案。工程實作前需經 API owner 確認；TTFT／ITL／錯誤率 SLO、GPU 溫度／VRAM 告警門檻及嚴重度政策須由客戶與 SRE/TAM 核定。未核定的 SLO 一律顯示「未設定」，不得標成違反 SLA。首版只讀，不新增改告警狀態或操作叢集的能力。

**優先序：**P0 = pilot 接線或安全驗收的前置條件；P1 = 首版必要功能；P2 = pilot 驗證與發布收尾。優先序不是工期估算。所有驗收細節見[逐項驗收任務](./acceptance-tasks-metrics-api-2026-11-13.md)。

## 建議執行順序與 backlog

### 切片 0｜盤點及契約凍結

| ID | 優先序 | 工作項目與完成條件 | 依賴 | 對應驗收 |
|---|---|---|---|---|
| B-01 | P0 | **確認原型與程式接線邊界。**盤點現有前端路由、mock 資料位置、部署方式及可重用元件；列出由 mock 切換到 API 的檔案／模組，不改變使用者可見範圍。 | 無 | AT-01、AT-04、AT-07、AT-09 |
| B-02 | P0 | **完成 pilot 資料與政策盤點。**確認客戶、cluster、deployment、GPU 型號與數量；metrics backend、DCGM exporter、vLLM 版本與實際 `/metrics`；alert source；SSO/RBAC；資料 cadence、SLO、門檻、runbook owner。未知項目有 owner 與待決紀錄。 | 無 | AT-01、AT-06、AT-08、AT-09、AT-16、AT-18 |
| B-03 | P0 | **定稿前端 BFF 契約及指標 mapping。**確認提案 API 的路徑、schema、錯誤 envelope、篩選、時間窗、聚合語義、單位、labels 與 pagination；以實際 exporter/vLLM 版本驗證 mapping。保留 mock/fixture 契約供測試。 | B-01、B-02 | AT-04–AT-14、AT-17 |

### 切片 1｜安全的唯讀資料層

| ID | 優先序 | 工作項目與完成條件 | 依賴 | 對應驗收 |
|---|---|---|---|---|
| B-04 | P0 | **身分驗證及 server-side 授權。**沿用可用的企業 SSO/OIDC；支援 TAM 與 customer_viewer 的核定權限；每次請求都驗證 tenant → cluster → deployment 關係，拒絕僅靠呼叫者傳入 ID 的授權。 | B-02、B-03 | AT-01–AT-03 |
| B-05 | P1 | **受限的 metrics query adapter。**實作 canonical metric allowlist 與固定查詢模板；不接受任意 PromQL、不向瀏覽器暴露 Prometheus endpoint/憑證；限制時間跨度、點數／series、回應大小、速率與 timeout。 | B-03、B-04 | AT-10、AT-17 |
| B-06 | P1 | **GPU inventory 與指標 adapter。**以 pilot 實際 DCGM/inventory 欄位映射 GPU ID、node、model、utilization、VRAM、temperature、power、ECC 與健康狀態；正規化單位，明示聚合方法，處理 counter reset 與缺樣本。 | B-02、B-03、B-05 | AT-04–AT-06、AT-11、AT-13 |
| B-07 | P1 | **vLLM inference adapter。**針對實際 vLLM 版本驗證 metrics；提供 output TPS、request rate、TTFT/ITL 分位數、running/waiting queue、KV cache；TPOT 保持獨立語義。錯誤率只使用核定的權威來源，SLO 可未設定。 | B-02、B-03、B-05 | AT-07、AT-08、AT-11–AT-13 |
| B-08 | P1 | **告警唯讀 adapter。**沿用核定的既有 alert source，正規化 severity/status、時間、resource、observed value/threshold、source、runbook 與 dedup key；保留來源 ID，不提供 acknowledge/resolve/assign 寫入。 | B-02、B-03、B-04 | AT-09、AT-15 |
| B-09 | P1 | **資料新鮮度、部分故障與一致錯誤處理。**回應帶樣本時間／asOf/freshness；缺值、真實 0 與 stale 可區分；上游 timeout/中斷回傳可辨識錯誤或部分可用狀態，不偽裝成健康。支援穩定 error code 與 request ID。 | B-03、B-05–B-08 | AT-06、AT-14、AT-17 |
| B-10 | P1 | **最低必要稽核與服務可觀測性。**記錄登入、授權拒絕、查詢錯誤及告警詳情存取；不記錄 token、密碼或客戶 prompt/請求內容；呈現 API 與來源健康及最後採集時間。保留政策待客戶確認。 | B-02、B-04、B-09 | AT-16、AT-18 |

### 切片 2｜前端接線與診斷流程

| ID | 優先序 | 工作項目與完成條件 | 依賴 | 對應驗收 |
|---|---|---|---|---|
| B-11 | P1 | **GPU 總覽、下鑽與趨勢。**將 GPU 頁面改接 BFF；支援 cluster summary、node/GPU 明細、health 篩選與 6h/24h/7d 趨勢；單位、sample time、資料新鮮度及聚合方式可見。 | B-03、B-06、B-09 | AT-04–AT-06、AT-15 |
| B-12 | P1 | **Inference deployment 總覽與趨勢。**將推理頁面改接 BFF；顯示 output TPS、TTFT/ITL P50/P95、queue、KV cache、來源可提供的 error rate、SLO 或「未設定」與 freshness。 | B-03、B-07、B-09 | AT-07、AT-08、AT-15 |
| B-13 | P1 | **告警列表、詳情與手動交接。**支援依 severity/status/resource/time 篩選、分頁、詳情、複製 alert ID、開啟 runbook 或既有支援渠道；不顯示未實作的變更狀態操作。 | B-03、B-08、B-09 | AT-09、AT-15 |
| B-14 | P1 | **載入、無資料與來源異常 UI 狀態。**所有資料視圖區分 loading、empty、zero、stale、partial failure 與 error；停用或移除會把 mock 數據冒充實況的路徑。 | B-01、B-09、B-11–B-13 | AT-05–AT-09、AT-14 |

### 切片 3｜品質、安全及 pilot 驗收

| ID | 優先序 | 工作項目與完成條件 | 依賴 | 對應驗收 |
|---|---|---|---|---|
| B-15 | P0 | **自動化單元、契約與授權測試。**覆蓋 counter reset、histogram bucket 合併、replica/cluster 聚合、時區、無資料、stale、上游 timeout、unsupported metric、越權直連 API；使用可重現 fixture。 | B-03、B-04–B-09 | AT-02–AT-06、AT-10–AT-17 |
| B-16 | P1 | **Pilot 效能與運行驗證。**在已核定的 pilot 負載及來源 cadence 下量測 summary/range query latency、freshness、限制與錯誤率；任何暫定目標須標為待確認，記錄測試環境與結果。 | B-05–B-10、B-15 | AT-06、AT-14、AT-17、AT-18 |
| B-17 | P2 | **TAM 與客戶端到端驗收及發布檢核。**使用非 mock 的 pilot 資料走完 GPU 健康、deployment SLO 狀態、最高優先告警三個問題；確認授權、資料標示、手動支援交接和回退方案。 | B-11–B-16 | AT-18、AT-19 |

## 建議的完成定義

- 對應驗收任務通過，API schema 與單位／聚合語義有測試或文件佐證。
- 任何客戶尚未確認的 SLO、門檻、資料保留或 owner 仍明顯標為待決，不以預設值代替核准。
- 權限在伺服器端逐次檢查；瀏覽器無 Prometheus 直連、憑證或任意查詢能力。
- 0、無資料、stale、來源中斷與部分可用狀態在 API 和 UI 均可區分。
- Pilot 畫面僅呈現實際來源資料；無法取得的欄位顯示未提供／未設定，不回填 mock 或 0。
- 首版所有告警與叢集操作維持唯讀。

## 需先決定、不可由工程自行猜定的事項

1. Pilot 客戶/cluster/deployment 和測試使用者及其實際授權範圍。
2. 實際 metrics backend、DCGM exporter/vLLM 版本、metric labels、collection/scrape cadence 與網路認證方式。
3. Alertmanager/既有告警平台的 owner、severity mapping、去重規則與 runbook URL。
4. 客戶核定的 TTFT、ITL、error-rate SLO；GPU 溫度/VRAM 門檻及 stale 判準。尚未核定時只能標示「未設定」。
5. API 正式契約，以及 pilot 效能目標和資料所在地／稽核保留要求。

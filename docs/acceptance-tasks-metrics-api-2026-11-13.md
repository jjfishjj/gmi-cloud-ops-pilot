# GMI Cloud AI 叢集營運儀表板｜逐項驗收任務

> 狀態：待實作後執行；此文件定義驗收腳本，不表示任何項目目前已通過。  
> 依據：[MVP 規格與 Metrics / API 清單](./MVP-spec-metrics-api-2026-11-13.md)與[工程待辦](./engineering-backlog-metrics-api-2026-11-13.md)。

## 執行前準備

- API 路徑與 schema 以工程確認後的契約為準；規格中的 `/api/v1` 路徑均是提案。
- 準備合成資料 fixture，以及 pilot 環境的非敏感測試資料。Fixture 至少能表示真實零值、無樣本、過期樣本、counter reset、分散 histogram buckets、多 replica、上游 timeout 和不同授權範圍。
- 取得 TAM 與 customer_viewer 測試身份，以及一個授權和一個未授權的 tenant/cluster/deployment 識別碼。不得以真實客戶 prompt 或請求本文作測試記錄。
- 只有在客戶已提供並核定 SLO/門檻時才驗證數值比較；未設定時需驗證 UI 明示「SLO 未設定」，不能推定 SLA。
- 每項通過後記錄 build/commit、測試環境、fixture/資料時間範圍、結果及必要的 request ID；不得在紀錄中保存 token、密碼或機敏 payload。

## 單項驗收

### AT-01｜已授權使用者登入與初始範圍

**關聯待辦：**B-03、B-04、B-11–B-13。  
**前置：**有效 TAM 與 customer_viewer 身份；各自核定的客戶/叢集範圍。

- **Given** 使用者已通過企業登入，且其身份有一個 pilot cluster 的檢視權限。
- **When** 使用者初始化 dashboard 並讀取可存取資源清單。
- **Then** API 僅回傳該身份被授權的客戶、cluster 與 deployment；UI 只呈現其可存取範圍，未登入請求回傳穩定的未認證錯誤。

**通過證據：**兩種身份的回應/畫面與未登入負向請求結果；敏感 token 不入證據。

### AT-02｜跨 tenant 直接請求必須拒絕

**關聯待辦：**B-04、B-15。  
**前置：**取得未授權 tenant/cluster ID；使用有效但不具該範圍權限的身份。

- **Given** 使用者已登入，但未獲授權查看目標 tenant。
- **When** 直接呼叫目標 tenant 下的 cluster 清單或資料端點，而非只測 UI 隱藏項目。
- **Then** server-side 授權拒絕請求，不回傳目標租戶資料；拒絕格式及 request ID 符合契約，且記錄最小必要稽核事件。

**通過證據：**API 負向測試與授權拒絕事件；確認回應不洩漏資源存在與否以外的敏感資料。

### AT-03｜Cluster 與 deployment 範圍授權

**關聯待辦：**B-04、B-15。  
**前置：**建立同一 tenant 中一個已授權和一個未授權的 cluster/deployment 測試對象。

- **Given** 使用者對 tenant 有登入身份，但只獲授權其中一部分 cluster/deployment。
- **When** 以直接 API 請求存取未授權 cluster、GPU、deployment summary、timeseries 或 alerts。
- **Then** 每一類端點都在 server-side 拒絕未授權資源；改寫或猜測 ID 不得擴大權限。

**通過證據：**各資源層級的授權矩陣測試結果。

### AT-04｜GPU 總覽與單卡下鑽

**關聯待辦：**B-03、B-06、B-11。  
**前置：**Fixture/pilot inventory 至少含 GPU ID、node、model、health、sample time；GPU 型號或總數以盤點結果為準。

- **Given** GPU inventory 與有效指標可用。
- **When** 使用者開啟 cluster GPU 總覽、選取 node 或 GPU，並開啟單卡詳情。
- **Then** 清單與詳情對應到同一 GPU/node；型號、health、利用率、VRAM、溫度及時間戳以實際可用欄位呈現，單位和摘要聚合方式可辨識。

**通過證據：**至少一張 GPU 的 API/畫面值與 fixture 或來源查詢對照；缺少欄位須顯示未提供，不能補 0。

### AT-05｜GPU 時間窗、單位與 0/無資料區別

**關聯待辦：**B-03、B-06、B-11、B-14、B-15。  
**前置：**Fixtures 各含有效數值為 0、有樣本但無資料、完整時間序列三種情況。

- **Given** 有 GPU utilization、VRAM 與溫度的可用樣本，及上述三種邊界狀態。
- **When** 分別選擇 6h、24h、7d 並查看圖表/摘要。
- **Then** 三個時間範圍均可查詢；VRAM 單位一致（API bytes，若 UI 用其他單位需明確標示）；真實 0、無資料與 stale 不混淆；時間序列時間與單位可讀。

**通過證據：**各時間範圍回應和三種邊界狀態的 UI/API 測試。

### AT-06｜資料新鮮度與過期呈現

**關聯待辦：**B-03、B-06、B-07、B-09、B-11、B-12、B-14。  
**前置：**來源實際採集 cadence 已量測；以該 cadence 建構正常與超過兩個有效更新間隔的 fixtures。

- **Given** 一份新樣本、一份真實零值、一份缺樣本，以及一份超過兩個來源更新間隔的樣本。
- **When** API 回傳摘要/時間序列且 UI 顯示資料狀態。
- **Then** API 提供可追溯的 sample time/asOf/freshness；超過兩個有效採集間隔時標記 stale/來源異常並顯示最後樣本時間；不把缺值或舊值當成健康 0，也不把 scrape 頻率誤稱為硬體採樣頻率。

**通過證據：**在已記錄 cadence 的 fixture/環境中驗證狀態轉換及時間戳。

### AT-07｜單一 vLLM deployment 推理指標

**關聯待辦：**B-03、B-07、B-12。  
**前置：**實際 pilot vLLM 版本與 `/metrics` mapping 已確認；若 error rate 來源不可用，已記錄不提供的原因。

- **Given** 一個 deployment 有來源可提供的推理 metrics。
- **When** 使用者開啟 inference summary 與趨勢。
- **Then** output tokens/s、TTFT P50/P95、ITL P50/P95、running/waiting queue、KV cache，以及權威來源有提供時的 error rate，以正確單位與統計語義呈現；UI 顯示來源時間與 freshness。

**通過證據：**UI/API 與版本相符的實際 `/metrics` 樣本或可重現 fixture 對照；未提供的 metric 不補值。

### AT-08｜已核定與未設定的 SLO

**關聯待辦：**B-02、B-03、B-07、B-12。  
**前置：**準備一份帶有核定來源/版本的測試 SLO 設定；另準備無 SLO 設定的 deployment。沒有客戶核定值時只執行未設定路徑。

- **Given** 一個 deployment 有已核定 SLO，另一個沒有設定 SLO。
- **When** 開啟各自的 inference summary，並以 fixture 測試達標、超標與未設定情況。
- **Then** 有核定時顯示目標、單位及狀態；未設定時明示「SLO 未設定」；沒有核定依據時不得顯示「違反 SLA」或自行建立客戶門檻。

**通過證據：**核定設定來源、比較結果及未設定狀態截圖/測試結果。不得在公開證據內包含機敏客戶資料。

### AT-09｜告警清單、詳情及唯讀交接

**關聯待辦：**B-03、B-08、B-13、B-14。  
**前置：**可用 alert fixture/來源涵蓋不同 severity、status、resource、時間及 runbook 有/無的情況。

- **Given** 告警來源提供了標準化告警及來源 ID。
- **When** 使用者以 severity/status/resource/time 篩選清單，打開一則告警詳情並啟動可用的手動交接方式。
- **Then** 顯示來源 ID、觸發/更新時間、觀測值與門檻（若來源有）、相關資源、source、runbook 或其未提供狀態；可以複製 ID/開啟連結；沒有 acknowledge/resolve/assign 或修復操作。

**通過證據：**篩選與詳情的 API/UI 結果；確認沒有告警寫入端點或可觸發寫入的 UI 控制項。

### AT-10｜瀏覽器與 metrics backend 隔離

**關聯待辦：**B-05、B-15。  
**前置：**可檢視瀏覽器 network requests、前端 bundle/config 及後端設定。

- **Given** 使用者正常瀏覽 GPU 與 inference 頁面。
- **When** 檢查瀏覽器請求、前端資產及服務設定。
- **Then** 瀏覽器只呼叫已授權的 BFF/API，不直連 Prometheus 或 GPU 節點；前端不包含 Prometheus 憑證/secret；任意 PromQL 無法由 UI/API 注入上游。

**通過證據：**network/config 檢查及負向查詢測試；不在輸出中抄錄任何憑證。

### AT-11｜Counter reset 安全處理

**關聯待辦：**B-06、B-07、B-15。  
**前置：**為 GPU ECC counter 及 vLLM request/token counter 準備包含正常增加、process/exporter reset 的序列。

- **Given** counter 在時間序列中曾重置或降低。
- **When** adapter 計算窗口內 rate/increase 或 ECC 增量。
- **Then** reset 後不產生負速率、巨大假尖峰或錯誤的累積增量；reset 處理符合選定的查詢語義，未知/缺資料保持可辨識。

**通過證據：**fixture 前後值與預期 rate/increase 的自動化測試。

### AT-12｜Histogram 合併與 ITL/TPOT 區分

**關聯待辦：**B-03、B-07、B-15。  
**前置：**準備至少兩個 replica 的 histogram bucket fixture，以及獨立 ITL 和 request-level TPOT 範例。

- **Given** 多個 replica 各自提供分布不同的 histogram buckets。
- **When** API 計算 deployment 層級的 TTFT/ITL 分位數。
- **Then** 先合併相容的 bucket counts 再計算分位數，不平均 replica quantile；ITL 不被 TPOT 取代或混標，TPOT 如顯示則獨立標示。

**通過證據：**用已知 bucket count 推導期望結果的測試，包含 ITL/TPOT 欄位名稱和說明檢查。

### AT-13｜Replica、GPU 與 cluster 聚合語義

**關聯待辦：**B-03、B-06、B-07、B-15。  
**前置：**準備不同 replica/GPU 值及混合型號或 labels 的 fixtures。

- **Given** 多 GPU 或多 replica 的來源資料，且各指標有明確適用的 sum/mean/max/quantile 語義。
- **When** 查詢 deployment 或 cluster summary。
- **Then** 只按契約定義聚合；不把不同語義 series 或型號混加，不把百分比相加；KV cache replica 分布保留，總覽聚合按已定義方式呈現。

**通過證據：**每個聚合欄位有明確標記並由測試值驗證。

### AT-14｜上游 timeout、中斷及部分可用

**關聯待辦：**B-09、B-14、B-16。  
**前置：**可模擬 Prometheus、vLLM 或告警來源 timeout/不可達，並測試不同來源各自故障。

- **Given** 一個上游逾時或失聯，而其他來源仍可用，或所有來源均不可用。
- **When** 呼叫摘要、metrics、alerts API 並查看 UI。
- **Then** API 以穩定錯誤碼、request ID 或明確 partial-availability 狀態回應；UI 說明受影響區域與最後有效更新時間；可用來源仍可檢視；不以 0/healthy 代替故障。

**通過證據：**單一上游故障與全來源故障兩種案例的 API/UI 結果。

### AT-15｜UTC 時間與使用者時區

**關聯待辦：**B-03、B-08、B-11–B-13、B-15。  
**前置：**準備 UTC 時間樣本和會跨越日期邊界的本地時區測試案例。

- **Given** API 以 UTC ISO-8601 傳回 sample/alert timestamps。
- **When** 使用者在支援的本地時區查看圖表、篩選時間及告警詳情。
- **Then** API 時間仍可正確解析；UI 依使用者時區一致格式化，排序、查詢範圍與顯示不因時區轉換改變事件先後或漏資料。

**通過證據：**跨日期邊界的 API 與 UI 測試。

### AT-16｜最低必要稽核事件

**關聯待辦：**B-04、B-08、B-10。  
**前置：**確認稽核事件目的、可見角色與保留政策；若政策未決，記錄為發布前待決而不自行設期限。

- **Given** 使用者登入、成功讀取資料、被拒絕存取，以及開啟告警詳情。
- **When** 產生稽核紀錄並檢查 log 欄位。
- **Then** 可追溯必要的身份/時間/動作/資源範圍與結果；不記錄 token、密碼、prompt、客戶請求本文；存取控制符合已核定政策。

**通過證據：**經遮蔽的 log 欄位檢查；保留期限只按核定政策驗證。

### AT-17｜查詢 allowlist 與資源限制

**關聯待辦：**B-03、B-05、B-09、B-15、B-16。  
**前置：**API 契約已指定允許的 metric 名稱、window/start/end/step 邊界、點數與回應限制。

- **Given** 正常的允許查詢，以及未知 metric、任意 PromQL、超長範圍、無效時間、超大 step/series/limit 等輸入。
- **When** 呼叫 metrics/timeseries API。
- **Then** 允許查詢在契約限制內成功；不允許的 metric、範圍或查詢均以穩定且安全的錯誤拒絕；伺服器不執行任意 PromQL，資源限制不被繞過。

**通過證據：**邊界值與負向測試，及上游查詢內容檢查。

### AT-18｜Pilot cadence、資料新鮮度與效能量測

**關聯待辦：**B-02、B-10、B-16。  
**前置：**確認 pilot 實際 collection/scrape cadence、既定負載、測量窗口及工程/客戶核定的性能目標。若目標未核定，只產出量測結果，不判為通過正式 SLO。

- **Given** pilot metrics/alert 來源穩定運作並記錄其更新 cadence。
- **When** 在約定負載下反覆查詢 summary 與圖表 range query，並觀察樣本到 API/UI 可見的延遲。
- **Then** 回報 P95 延遲、錯誤率、資料 freshness、查詢限制與測試條件；只有與已核定目標比較時才判定達標；超過兩個有效來源更新間隔需可見 stale 狀態。

**通過證據：**帶環境/負載/測試時間範圍的量測結果及已核定目標來源。規格提案中的 P95 數字在批准前不得當成正式承諾。

### AT-19｜TAM/客戶端到端 pilot 驗收與發布檢核

**關聯待辦：**B-17。  
**前置：**AT-01–AT-18 中適用於 pilot 的項目通過；使用非 mock 的 pilot 資料；測試者範圍與資料已獲授權。

- **Given** 受邀 TAM 與 customer_viewer 可登入，且儀表板使用實際 pilot 遙測與告警來源。
- **When** 使用者在一次不超過 15 分鐘的操作中：(1) 判斷 GPU 是否健康，(2) 判斷推理 SLO 是異常或未設定，(3) 找到最高優先待檢視告警並取得手動交接資訊。
- **Then** 三個問題皆可由畫面提供有來源時間/單位/狀態的證據回答；不同角色只能看到授權範圍；無 mock 數字冒充實況、沒有寫入/修復操作；未決政策與已知限制已明示，並記錄 TAM/客戶結果及阻塞項目。

**通過證據：**測試者、build、資料來源、完成時間、每個問題的結果與未解事項。此驗收不等同於客戶對尚未核定 SLO 的正式承諾。

## 驗收結果紀錄範本

每個 AT 項目請記錄：`ID`、`結果（通過／失敗／阻塞／不適用）`、`build/commit`、`環境`、`執行者/日期`、`前置資料或 fixture 版本`、`測試輸出/request ID`、`失敗或待決事項`。不要記錄憑證或敏感請求內容。

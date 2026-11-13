# GMI Cloud AI 叢集營運儀表板｜MVP 規格與 Metrics / API 清單

> 版本：0.1（提案）　狀態：可供資料來源盤點與工程估算
>
> **重要：**目前已發布的 `gmi-cloud-ops/index.html` 是展示原型；畫面上標示的客戶、數字、告警、節省金額及工單均為模擬資料，未連接任何真實客戶叢集。本文件中的 API 路徑、欄位、門檻與驗收數字是 MVP 建議，不代表現有正式服務或已確認的客戶 SLO。

## 1. MVP 一句話

先為**一個企業客戶、一個叢集、一個 vLLM 推理部署**提供安全的唯讀營運視圖，讓 TAM 與客戶可回答三個問題：GPU 是否健康？推理效能是否符合該部署的目標？目前有哪些告警需要檢視或升級處理？

此選擇延續現有展示儀表板與既有決策：先驗證一個客戶的資料接線、指標解讀和告警流程，再擴展到 8 個美國／亞洲資料中心、更多叢集與其他工作負載。資料模型預留多租戶、多叢集和 H100/H200，但**首波不要求接通全部 8 個資料中心**。

## 2. 使用者與核心流程

**主要使用者：**客戶技術客戶經理（TAM）與該企業客戶的 AI／平台工程師。第一版以登入後唯讀檢視為主，兩種角色都只能看到被授權的客戶／叢集範圍。

1. **檢查 GPU 健康：**選擇客戶叢集，查看 GPU 清單、型號、健康狀態、使用率、VRAM、溫度與資料新鮮度；可按節點／GPU 下鑽及查看所選時間範圍的趨勢。
2. **診斷 vLLM 推理效能：**選擇一個部署，查看輸出 tokens/s、TTFT、ITL、等待佇列、KV cache 與可用的請求錯誤率；比較趨勢和該部署已設定的 SLO。
3. **檢視及升級告警：**按嚴重度、狀態、資源與時間篩選，打開告警詳情，查看觸發時間、觀測值、門檻、相關部署／GPU 和建議 runbook；若需支援，複製告警識別碼並轉交既有支援管道。

## 3. 首版範圍與明確不做

### 首版包含

- 單一客戶 tenant、單一 GPU 叢集、H100 或 H200 GPU；一個 vLLM 推理 deployment。SGLang 先留作後續 adapter。
- GPU 健康與資源觀測；vLLM 推理服務效能觀測；由既有告警來源匯入、正規化並唯讀呈現告警。
- 時間範圍：6 小時、24 小時、7 天；支援總覽、趨勢、資源詳情和資料來源／最後更新時間。
- 沿用現有 React／Next.js App Router／TypeScript／Tailwind／Shadcn UI 深色介面方向；將展示資料明確替換成 API 資料，缺值不得以 0 代替。
- 後端 API 作為前端與指標儲存層之間的唯讀 BFF／資料適配層；瀏覽器不直接連 Prometheus 或 GPU 節點。

### 首版不包含

- 一次上線 8 個資料中心，或多客戶自助開通／跨租戶比較。
- SGLang、訓練工作控制面、Slurm／Ray 工作管理、NCCL 瓶頸分析、InfiniBand／RoCE 與 Ceph／NVMe／NFS 深度儲存分析。
- 自動修復、GPU／佇列縮容、重新部署、排程變更或任何會改變叢集狀態的操作。
- 在新平台內建立／更新客服工單、營運審查報告產生器、正式成本節省承諾或 FinOps 動作。先保留連至既有支援流程的手動交接。
- 以 AI 產生未經確認的根因或自動套用建議。

## 4. 建議資料流與資料來源

```text
GPU 節點：DCGM Exporter ─┐
                         ├─> Prometheus 相容指標儲存層 ─> Dashboard BFF/API ─> Next.js UI
vLLM /metrics ───────────┘                │
                                         └─> Alertmanager 或既有告警來源 ─> 告警唯讀 API
```

- **GPU 遙測：**優先盤點是否已有 NVIDIA DCGM Exporter。官方文件說明它將選取的 DCGM telemetry 轉成 Prometheus exposition format；預設可在節點 `:9400/metrics` 提供資料，Prometheus scrape 與 DCGM collection cadence 是不同設定，scrape 頻率高於硬體採樣不會帶來較新的硬體樣本。[NVIDIA：DCGM Exporter 安裝與設定](https://docs.nvidia.com/datacenter/dcgm/latest/installation/install-dcgm-exporter.html)、[NVIDIA：Prometheus 設定](https://docs.nvidia.com/datacenter/dcgm/latest/learn/getting-started-for-system-administrators/configure-prometheus-for-dcgm-exporter.html)
- **推理遙測：**由部署端的 vLLM `/metrics` 採集。vLLM 官方文件列出 Prometheus 相容的 server-level gauges、counters 與 request-level histograms；但原型顯示的 vLLM `0.6.3` 不可直接假設與目前文件中的 metric 名稱及語義完全相同，接線前須在客戶實際版本擷取 `/metrics` 並驗證。[vLLM：Metrics](https://docs.vllm.ai/en/stable/design/metrics/)
- **告警：**優先沿用現有 Alertmanager／告警平台；若無可用來源，先從有 owner 的 Prometheus alert rules 產生，再由適配層轉成下方 API 的共通格式。不得在前端重寫一套與營運告警來源不一致的判斷。
- **資料時間：**保留樣本時間、採集時間與 API 回應時間。超過兩個有效採集間隔未收到新樣本時，顯示「資料過期／來源中斷」及最後樣本時間；不可顯示成健康的 0。

## 5. 指標字典

API 對前端提供以下正規化名稱與標準單位。原始 Prometheus series 由後端適配層映射；DCGM 欄位是否啟用、實際 metric 名稱、單位和 labels，須以客戶當前 exporter 版本與 collector 設定為準。

| 指標（API canonical name） | 定義／顯示單位 | 型態／聚合建議 | 建議來源與備註 |
|---|---|---|---|
| `gpu_utilization_pct` | GPU 運算使用率，0–100% | Gauge；單卡趨勢，叢集顯示卡數平均及 P95 | DCGM `DCGM_FI_DEV_GPU_UTIL`；勿把無樣本當 0 |
| `gpu_vram_used_bytes` | 已用 VRAM，bytes | Gauge；單卡；總量只在同型態可比時加總 | DCGM framebuffer used/free 欄位；官方文件示例中的 `DCGM_FI_DEV_FB_USED` 單位為 MiB，適配層須轉成 bytes |
| `gpu_vram_total_bytes` / `gpu_vram_used_pct` | VRAM 總量／使用率，bytes／% | 總量來自 inventory 或 used+free；百分比逐卡計算 | 不把多卡百分比相加；型號混合時避免只顯示無權重平均 |
| `gpu_temperature_celsius` | GPU 溫度，°C | Gauge；逐卡與最高值；可依硬體／營運政策設門檻 | DCGM 溫度欄位；欄位名稱依 exporter/collector 版本驗證 |
| `gpu_power_watts` | GPU 功率，W | Gauge；逐卡及叢集總功率 | DCGM power 欄位；不要把功率和能耗 kWh 混用 |
| `gpu_ecc_dbe_total` / `gpu_ecc_sbe_total` | 雙位元／單位元 ECC 累積錯誤 | Counter；以增加量與告警事件呈現 | DCGM ECC 欄位；處理 exporter 重啟／counter reset |
| `gpu_health_state` | `healthy`／`warning`／`critical`／`unknown` | 離散狀態；按明確規則計算 | 結合 scrape health、硬體錯誤與營運告警；畫面需提供狀態理由 |
| `inference_output_tokens_per_second` | 每秒輸出 token 數 | Counter 的 rate；deployment 總量及時間序列 | vLLM `generation_tokens_total`；counter reset 要安全處理 |
| `inference_requests_per_second` | 完成請求數／秒 | Counter 的 rate | vLLM request completion counter；確認版本與成功／完成語義 |
| `inference_ttft_seconds` | Time to First Token | Histogram 分位數，至少 P50/P95 | vLLM `time_to_first_token_seconds`；以合併 buckets 算分位數，不平均各 replica 的 quantile |
| `inference_itl_seconds` | Inter-Token Latency（逐輸出 token 間隔） | Histogram 分位數，至少 P50/P95 | vLLM `inter_token_latency_seconds`；不要與 request-level TPOT 混稱 |
| `inference_tpot_seconds` | Per-request Time Per Output Token | Histogram 分位數；獨立於 ITL | vLLM `request_time_per_output_token_seconds`；僅在 UI 明確標成 TPOT 時使用 |
| `inference_running_requests` / `inference_waiting_requests` | 執行中／等待中的請求數 | Gauge；deployment／replica | vLLM `num_requests_running` / `num_requests_waiting`；若使用多 replica，定義聚合方式 |
| `inference_kv_cache_used_pct` | KV cache 使用比例，0–100% | Gauge；保留 replica 分布，總覽可顯示最大值與平均值 | vLLM `kv_cache_usage_perc` 為 0–1 比例，適配層轉為百分比 |
| `inference_error_rate_pct` | 錯誤請求占比，% | 窗口內錯誤數／總請求數 | 優先取 API gateway／serving layer 的 HTTP 5xx、timeout；不得誤把 vLLM 的正常完成 reason 當 HTTP 成功率 |
| `telemetry_freshness_seconds` | 最新有效樣本距目前時間 | Gauge／API 計算欄位 | 以來源樣本時間計算；超過兩個採集間隔標為 stale |

**時間序列／統計規則：**統一使用 UTC ISO-8601 時間；UI 可依使用者時區格式化。Gauge 直接呈現；Counter 用指定窗口的 rate/increase；Histogram 分位數用桶合併後計算。叢集聚合需註明是 mean、max、sum 或 quantile；模型、replica、GPU 等 labels 不得在跨不同語義的 series 上盲目加總。vLLM 官方文件特別區分 ITL 與 TPOT，兩者因觀測粒度與加權方式不同，不應互相代替。

## 6. Dashboard API（提案）

統一以 `/api/v1` 版本化。所有路徑均透過登入 session／OIDC token 驗證；使用者可存取的 tenant 由身分與授權政策決定，不能只因呼叫者自行填入 `clusterId` 就授權。下列路徑是 Dashboard BFF 對 UI 的建議契約，**不是現有正式端點**。

| Method / path | 用途與主要參數 |
|---|---|
| `GET /api/v1/me` | 回傳登入者、角色、可存取 customer/cluster 清單；UI 初始化與權限判斷 |
| `GET /api/v1/clusters/{clusterId}` | 叢集名稱、region、GPU 型號／數量、連線狀態、時區及資料來源狀態 |
| `GET /api/v1/clusters/{clusterId}/summary?window=1h` | 總覽 KPI、GPU health counts、deployment 摘要、active alert counts、`asOf`/freshness；`window` 限制為 `6h`、`24h`、`7d` |
| `GET /api/v1/clusters/{clusterId}/gpus?health=warning&limit=50&cursor=...` | 分頁 GPU inventory/snapshot，支援 node、model、health 篩選；回傳 GPU ID、node、型號、狀態、主要即時指標和 sample time |
| `GET /api/v1/clusters/{clusterId}/metrics?names=gpu_utilization_pct,gpu_temperature_celsius&start=...&end=...&step=60s&groupBy=gpu` | 僅接受 allowlist 中的 canonical metric 名稱；回傳時間序列。若 `step` 省略，由伺服器依時間跨度決定解析度 |
| `GET /api/v1/clusters/{clusterId}/deployments` | 列出該叢集使用者可見的推理 deployment、model、engine/version、replica 數和健康狀態 |
| `GET /api/v1/deployments/{deploymentId}/inference/summary?window=1h` | output TPS、request rate、TTFT/ITL P50/P95、queue、KV cache、error rate、部署 SLO 和資料新鮮度 |
| `GET /api/v1/deployments/{deploymentId}/inference/timeseries?names=inference_output_tokens_per_second,inference_ttft_seconds&start=...&end=...&step=60s` | vLLM canonical metrics 的時間序列；支援可控的 replica/model 分組 |
| `GET /api/v1/alerts?clusterId=...&severity=critical&status=firing&from=...&to=...&limit=50&cursor=...` | 告警清單、分頁與篩選；狀態只讀 |
| `GET /api/v1/alerts/{alertId}` | 告警詳情、觸發規則、觀測值／門檻、時間、相關資源、來源、runbook URL 和 dedup key |

Prometheus 的 range query 可用 RFC3339 或 Unix timestamp 的 `start`／`end` 及 `step`；BFF 可以依此呼叫內部 Prometheus API，但不要把底層 Prometheus 原始 API、憑證或任意 PromQL 暴露給瀏覽器。[Prometheus HTTP API：Range queries](https://prometheus.io/docs/prometheus/latest/querying/api/)

### 回應格式建議

成功回應使用一致 envelope；指標值保留單位與 sample time，例如：

```json
{
  "data": {
    "clusterId": "clu_123",
    "metrics": [{
      "name": "gpu_utilization_pct",
      "unit": "%",
      "aggregation": "avg",
      "series": [{
        "labels": {"gpuId": "gpu-01", "node": "node-01"},
        "points": [
          {"timestamp": "2026-11-13T06:00:00Z", "value": 72.4},
          {"timestamp": "2026-11-13T06:01:00Z", "value": 74.1}
        ]
      }]
    }]
  },
  "meta": {"asOf": "2026-11-13T06:01:12Z", "freshnessSeconds": 12, "stale": false}
}
```

錯誤使用穩定的 `{ "error": { "code", "message", "requestId" } }` 格式；至少定義 `UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`INVALID_RANGE`、`UNSUPPORTED_METRIC`、`UPSTREAM_UNAVAILABLE`、`STALE_DATA`。無資料與數值零要能區分；上游 Prometheus／告警來源故障時回傳可辨認的錯誤或部分可用狀態，不得把缺資料偽裝成健康。

### 即時更新策略

首版以**輪詢**開始：摘要 15–30 秒，圖表依資料源採集 cadence 更新；DCGM 預設 collection cadence 為 30 秒的部署情況下，不宣稱 5 秒硬體即時性。先用來源實際 cadence 與使用者需要驗證頻率。若輪詢對來源負載或體驗不合，再評估 SSE/WebSocket；它們不是首波必要條件。圖表時間窗的 range query 可由 Prometheus `/api/v1/query_range` 提供，並限制最大時間跨度、點數和允許指標集合。

## 7. 告警規則及唯讀互動

首版告警至少呈現 `severity`、`status`、`startedAt`、`lastUpdatedAt`、`resource`、`observedValue`、`threshold`、`summary`、`description`、`source`、`runbookUrl`。依 cluster／GPU／deployment 去重，保持來源 alert ID，並把同一故障造成的多個關聯告警分組或清楚連結。

- **GPU：**exporter／target 中斷、GPU 不可用、ECC DBE 增量、溫度或 VRAM 超過營運政策門檻；溫度門檻以特定 GPU 型號規格及營運政策為準，不在未盤點前硬編一個全域值。
- **推理：**TTFT P95 或錯誤率超過該 deployment 已核定 SLO；KV cache 長時間接近配置上限；等待佇列持續增加或 output TPS 顯著偏離經客戶確認的基準。
- 門檻、持續時間、維護時段、嚴重度與 runbook 由客戶／SRE/TAM 確認；先用持續時間、去重和維護窗口降低告警噪音。若尚未提供 SLO，不得把建議值標成「違反 SLA」。
- 「處理」在 MVP 中是查看上下文、複製 ID／分享詳情、開啟 runbook 或轉交既有支援渠道；不提供 ack/resolve/assign 寫入 API，也不執行修復。

## 8. 安全、權限與可觀測性

- 以 OIDC/企業 SSO（若現有登入服務可用）識別使用者；MVP 至少有 `TAM` 與 `customer_viewer` 角色。每個查詢都在伺服器端驗證 tenant → cluster → deployment 的授權關係；加入跨租戶負向測試。
- Prometheus 憑證只存在伺服器端；Dashboard BFF 僅提供唯讀查詢。DCGM exporter 與 vLLM `/metrics` 保持在私有網路／叢集內，使用既有 TLS、網路政策與認證方式，不直接公開給客戶瀏覽器。
- API 僅允許白名單指標與固定 PromQL 模板；限制時間範圍、series 數、回應大小、速率與 timeout；不接收任意 PromQL。必要時移除或遮蔽 pod、namespace、job 等不應跨角色曝光的 labels。
- 記錄登入、授權拒絕、查詢錯誤與告警詳情存取的最小必要稽核事件；不在 logs 記錄 token、密碼或可識別 prompt／客戶請求內容。保留時間、資料所在地和法規要求待客戶盤點確認。
- 呈現 API 健康、上游來源健康、最後採集時間及指標版本；資料源中斷或過期需明顯標示，且與真實的零值區隔。

## 9. MVP 驗收條件與成功衡量

### 功能驗收

1. 受邀 TAM 和客戶測試使用者登入後，僅能查看授權的一個客戶／叢集；跨 tenant、cluster、deployment 的直接 API 請求均被拒絕。
2. 指標來源中斷或超過兩個採集間隔時，UI 顯示 stale／來源異常及最後樣本時間；零值、缺值與 stale 三種狀況可區分。
3. 使用者可從 GPU 總覽下鑽到單卡，並在 6h／24h／7d 查看 utilization、VRAM 和溫度；百分比和單位有明確標籤。
4. 使用者可查看一個 vLLM deployment 的 output TPS、TTFT P50/P95、ITL P50/P95、queue、KV cache、來源可提供的 error rate，及對應的 SLO／SLO 未設定狀態。
5. 使用者可篩選並打開告警詳情，看到來源時間、觀測值／門檻、資源與 runbook／支援交接資訊；首版沒有修改叢集或告警狀態的操作。
6. 工程測試確認 counter reset、histogram 合併、replica 聚合、時區、無資料、上游 timeout 與授權拒絕不會產生誤導性數字。

### 上線前建議 SLO（需由工程與 pilot 客戶確認）

- 摘要 API 在既定 pilot 負載下 P95 ≤ 1 秒；圖表查詢 P95 ≤ 2 秒；若資料層或網路限制無法達成，量測後調整並明示。
- 在 30 秒 scrape/collection 設定下，GPU 指標新樣本於 90 秒內可見；超過兩個來源更新週期即顯示 stale。其他資料源依其實際 cadence 訂定。
- 整個 pilot 期間不發生跨租戶資料曝光；告警可追溯回來源事件；UI 所有數值可定位到 timestamp、單位與聚合方式。

**成功指標：**TAM 與客戶在一次 15 分鐘的操作中，能自行回答叢集 GPU 是否健康、推理 SLO 是否異常、需處理的最高優先告警是哪一項；資料完整性與授權測試通過，且 pilot 使用者無須依賴 mock 數字。產品化後再以使用頻率、事件發現時間、升級處理時間和告警誤報率追蹤價值；初期沒有基線前不預設改善百分比。

## 10. 開始工程前需盤點的未知項目

1. Pilot 客戶、叢集及一個 vLLM deployment 的實際 ID、region、GPU 型號／數量與登入測試者。
2. 現行 metrics backend（Prometheus、Thanos、Mimir 或其他）、保留期限、查詢 endpoint、認證方式、scrape/collection cadence 及網路邊界。
3. GPU 節點是否已運行相容的 DCGM Exporter；GPU inventory、節點／GPU／工作負載映射和 exporter collector 欄位是否可用。
4. 客戶使用的 vLLM 版本與 `/metrics` 範例；replica labels 是否完整；HTTP 5xx／timeout 的權威來源。
5. 告警來源、owner、severity 字典、去重方式、runbook 位置、維護窗口，以及告警由誰定義與批准。
6. 客戶服務 SLO（TTFT/ITL/error rate），GPU 溫度／VRAM 門檻和資料過期標準；若尚未定義，pilot 首版先展示觀測值並標示「SLO 未設定」。
7. 現有 SSO、tenant/cluster RBAC、資料所在地要求與稽核日誌保留政策。

完成上述盤點後，下一個工程步驟是挑定一個 pilot cluster，驗證 exporter 指標與 labels，產出 fixture/查詢測試，將現有 mock API 接成只讀 adapter，再由客戶與 TAM 做端到端驗收。

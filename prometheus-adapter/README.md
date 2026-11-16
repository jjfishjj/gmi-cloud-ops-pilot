# Prometheus 唯讀 adapter（試點介面）

這是給 GMI Cloud dashboard / 受信任 API gateway 使用的獨立 Node.js HTTP adapter。它只提供一個環境設定的叢集範圍與固定 canonical metric allowlist；API 呼叫者不能提交 PromQL，adapter 也只向 Prometheus 發出 `GET /api/v1/query_range`。本服務不執行叢集操作、告警修改或寫入查詢。

**目前尚未連接任何 pilot。**專案沒有實際 Prometheus URL、叢集標籤、DCGM/vLLM 版本、metric labels、SSO/RBAC 或核定資料來源。範例 metric mapping 是候選值，上線前必須用實際版本驗證。這個 adapter 只提供 metrics 查詢，不包含登入、per-user 授權、GPU inventory、告警或 SLO 來源。

## API

唯一資料端點：

```text
GET /api/v1/clusters/{clusterId}/metrics
    ?names=gpu_utilization_pct,inference_ttft_seconds
    &start=2026-11-16T10:00:00Z
    &end=2026-11-16T11:00:00Z
    &step=1m
Authorization: Bearer <adapter-to-gateway-token>
```

`start`、`end` 接受含時區的 RFC3339 或 Unix 秒數；`step` 為 15 秒至 1 小時，省略時由 adapter 選擇。最長查詢 7 天、最多 10,000 個時間點。`clusterId` 必須等於啟動設定的單一 cluster ID。

成功回應遵循 `{ data, meta }` envelope。`data.metrics[]` 包含 canonical `name`、`unit`、`aggregation`、series labels 與 UTC 時間點；`meta` 有 `asOf`、`latestSampleAt`、`freshnessSeconds`、`stale`、`hasData` 及來源 scrape cadence。沒有樣本時 `hasData=false`、`stale=null`、`freshnessSeconds=null`；真實數值 0 保留為 0。超過兩個設定 scrape 間隔的舊樣本會標成 `stale=true`。

錯誤使用 `{ error: { code, message, requestId } }`。包含 `UNAUTHENTICATED`、`INVALID_RANGE`、`UNSUPPORTED_METRIC`、`METRIC_NOT_CONFIGURED`、`UPSTREAM_TIMEOUT`、`UPSTREAM_UNAVAILABLE` 與 `UPSTREAM_LIMIT_EXCEEDED`。上游錯誤細節不會回傳給呼叫者。

`/healthz` 只檢查 adapter 行程存活，不檢查或洩漏 Prometheus 位址。非 GET 請求會被拒絕。額外的 `query`/PromQL 參數不會傳給 Prometheus。

## 支援的 canonical metrics

預設 mapping 位於 `server.mjs`；管理者可用環境變數將來源 metric identifier 對應到實際 exporter/vLLM 版本。環境變數只接受 Prometheus metric 名稱，不接受 PromQL 表達式。將某個 mapping 設為空字串可停用該欄位。

- GPU：`gpu_utilization_pct`、`gpu_vram_used_bytes`、`gpu_temperature_celsius`、`gpu_power_watts`、`gpu_ecc_dbe_total`、`gpu_ecc_sbe_total`
- 推理：`inference_output_tokens_per_second`、`inference_requests_per_second`、`inference_ttft_seconds`、`inference_itl_seconds`、`inference_tpot_seconds`、`inference_running_requests`、`inference_waiting_requests`、`inference_kv_cache_used_pct`

Counter rate 使用固定 5 分鐘 `rate()`；TTFT、ITL、TPOT 以合併 histogram buckets 計算 P50/P95，ITL 與 TPOT 保持不同 canonical 名稱；KV cache 預設將 0–1 比例轉為百分比；VRAM 預設視來源值為 MiB 並轉成 bytes。若 exporter/vLLM 樣本語義或單位不同，必須在環境設定中修正 mapping/unit。ECC 目前回傳來源累積 counter，不計算 reset-safe 增量；error rate、alerts、GPU inventory、tenant RBAC 和 SLO 不在此 adapter 範圍。

Labels 只回傳 `PROMETHEUS_LABEL_ALLOWLIST` 指定的欄位（預設是常見 GPU、node、model、replica 標籤），cluster selector label 不會回傳。不同 series 若在裁切敏感 labels 後無法區分，adapter 會回傳錯誤而不是偷偷合併。

## 本機啟動與測試

需要 Node.js 18 或更新版本，不需要額外 npm 套件：

```bash
cd prometheus-adapter
cp .env.example .env
# 在受控的本機環境編輯 .env，填入實際來源與至少 24 字元的隨機 adapter token
set -a; . ./.env; set +a
node server.mjs
```

執行自動測試：

```bash
node --test prometheus-adapter/server.test.mjs
```

本機可用：

```bash
curl -H 'Authorization: Bearer <adapter-to-gateway-token>' \
  'http://127.0.0.1:8787/api/v1/clusters/pilot-01/metrics?names=gpu_utilization_pct&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z&step=1m'
```

不要把 `.env`、Prometheus bearer token、adapter token 或客戶資料提交到 Git；Prometheus URL 與 token 僅讀取伺服器環境變數。adapter 預設綁定 `127.0.0.1`。若容器或 VM 必須使用 `HOST=0.0.0.0`，請只在私有網路中啟動，並放在可信任的 HTTPS 身份／RBAC gateway 後面。

## 身份、部署與 GitHub Pages

`DASHBOARD_API_TOKEN` 是**服務到服務**的共用 adapter token，不是使用者登入。對外部署必須由可信 gateway 驗證企業 SSO、逐使用者授權到該 pilot cluster，再由 gateway 在伺服器端注入 token；gateway 必須移除用戶端自行送來的同名 Authorization header。不能把此 token 放在瀏覽器、Next.js `NEXT_PUBLIC_*`、靜態 bundle、URL 或公開文件。CORS 只限制瀏覽器來源，不是認證或 RBAC；除非已先建立受信任登入流程，否則不要設定 `DASHBOARD_ORIGIN`。

GitHub Pages 是靜態託管，無法執行此 adapter。公開頁仍以合成 fixture 示範，不會連到本 API。未確認正式登入／授權架構、真實來源 mapping 與同源或受信任 gateway 部署方式前，不要公開本服務或把實際遙測接入公開頁面。

## 資源與查詢限制

adapter 對每個來源 IP 預設限制每分鐘 60 次；Prometheus request timeout 預設 8 秒；每次最多 8 個 canonical metrics、100 個 series、20,000 個返回點及 5 MiB 上游回應；同時最多 4 個上游查詢。查詢最大跨度 7 天、點數上限 10,000。以上是保守程式限制，不是已驗證的 pilot 效能承諾。

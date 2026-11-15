"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { Activity, BarChart3, CircleHelp, Cpu, Download, FileUp, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardFixture as demo } from "@/lib/mock-data";

type MetricGroup = "GPU" | "vLLM";
type MetricDefinition = { label: string; unit: string; group: MetricGroup; digits?: number };
type MetricSample = { timestamp: string; metric: string; value: number };
type MetricSummary = MetricDefinition & { key: string; count: number; latest: MetricSample; min: number; mean: number; max: number };

const METRICS: Record<string, MetricDefinition> = {
  gpu_utilization_pct: { label: "GPU 使用率", unit: "%", group: "GPU", digits: 1 },
  gpu_vram_used_pct: { label: "VRAM 使用率", unit: "%", group: "GPU", digits: 1 },
  gpu_temperature_celsius: { label: "GPU 溫度", unit: "°C", group: "GPU", digits: 1 },
  gpu_power_watts: { label: "GPU 功率", unit: "W", group: "GPU", digits: 1 },
  gpu_ecc_dbe_total: { label: "ECC DBE 累積數", unit: "次", group: "GPU", digits: 0 },
  inference_output_tokens_per_second: { label: "輸出吞吐量", unit: "tokens/s", group: "vLLM", digits: 1 },
  inference_requests_per_second: { label: "請求速率", unit: "requests/s", group: "vLLM", digits: 2 },
  inference_ttft_p50_seconds: { label: "TTFT P50", unit: "s", group: "vLLM", digits: 3 },
  inference_ttft_p95_seconds: { label: "TTFT P95", unit: "s", group: "vLLM", digits: 3 },
  inference_itl_p50_seconds: { label: "ITL P50", unit: "s", group: "vLLM", digits: 3 },
  inference_itl_p95_seconds: { label: "ITL P95", unit: "s", group: "vLLM", digits: 3 },
  inference_tpot_p95_seconds: { label: "TPOT P95", unit: "s", group: "vLLM", digits: 3 },
  inference_running_requests: { label: "執行中請求", unit: "requests", group: "vLLM", digits: 0 },
  inference_waiting_requests: { label: "等待佇列", unit: "requests", group: "vLLM", digits: 0 },
  inference_kv_cache_used_pct: { label: "KV cache 使用率", unit: "%", group: "vLLM", digits: 1 },
  inference_error_rate_pct: { label: "錯誤率", unit: "%", group: "vLLM", digits: 2 },
};

const CSV_HEADER = "timestamp,metric,value,cluster_id,node,gpu_id,deployment,replica";
const SAMPLE_CSV = [
  CSV_HEADER,
  "2026-11-15T10:00:00Z,gpu_utilization_pct,72,demo,node-01,gpu-01,,",
  "2026-11-15T10:00:00Z,gpu_vram_used_pct,68,demo,node-01,gpu-01,,",
  "2026-11-15T10:00:00Z,gpu_temperature_celsius,63,demo,node-01,gpu-01,,",
  "2026-11-15T10:00:00Z,inference_output_tokens_per_second,1840,demo,,,,replica-01",
  "2026-11-15T10:00:00Z,inference_ttft_p95_seconds,0.82,demo,,,,replica-01",
  "2026-11-15T10:00:00Z,inference_waiting_requests,4,demo,,,,replica-01",
  "2026-11-15T10:00:00Z,inference_kv_cache_used_pct,71,demo,,,,replica-01",
  "2026-11-15T10:01:00Z,gpu_utilization_pct,76,demo,node-01,gpu-01,,",
  "2026-11-15T10:01:00Z,gpu_vram_used_pct,69,demo,node-01,gpu-01,,",
  "2026-11-15T10:01:00Z,gpu_temperature_celsius,64,demo,node-01,gpu-01,,",
  "2026-11-15T10:01:00Z,inference_output_tokens_per_second,1910,demo,,,,replica-01",
  "2026-11-15T10:01:00Z,inference_ttft_p95_seconds,0.79,demo,,,,replica-01",
  "2026-11-15T10:01:00Z,inference_waiting_requests,3,demo,,,,replica-01",
  "2026-11-15T10:01:00Z,inference_kv_cache_used_pct,73,demo,,,,replica-01",
].join("\n");

function parseCsv(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { record.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((cell) => cell.trim() !== "")) records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV 格式錯誤：有未結束的引號。");
  record.push(field);
  if (record.some((cell) => cell.trim() !== "")) records.push(record);
  return records;
}

function summarize(samples: MetricSample[]): MetricSummary[] {
  const grouped = new Map<string, MetricSample[]>();
  for (const sample of samples) {
    const group = grouped.get(sample.metric);
    if (group) group.push(sample);
    else grouped.set(sample.metric, [sample]);
  }
  return [...grouped.entries()].map(([key, values]) => {
    const definition = METRICS[key];
    const ordered = [...values].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const numbers = values.map((item) => item.value);
    return {
      key,
      ...definition,
      count: values.length,
      latest: ordered[ordered.length - 1],
      min: Math.min(...numbers),
      mean: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      max: Math.max(...numbers),
    };
  }).sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label, "zh-Hant"));
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PostIngestionAnalysis() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [samples, setSamples] = useState<MetricSample[] | null>(null);
  const [parseNote, setParseNote] = useState("");
  const [error, setError] = useState("");
  const [skippedRows, setSkippedRows] = useState(0);
  const summaries = useMemo(() => samples ? summarize(samples) : [], [samples]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setParseNote("");
    setSamples(null);
    setSkippedRows(0);
    if (file.size > 5 * 1024 * 1024) { setError("檔案超過 5 MB 上限；請先縮小匯出範圍。檔案未上傳。 "); return; }
    try {
      const records = parseCsv(await file.text());
      if (records.length < 2) throw new Error("CSV 至少要有標頭和一筆資料。");
      const headers = records[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase());
      const indexes = { timestamp: headers.indexOf("timestamp"), metric: headers.indexOf("metric"), value: headers.indexOf("value") };
      if (indexes.timestamp < 0 || indexes.metric < 0 || indexes.value < 0) {
        throw new Error("缺少必要欄位。CSV 標頭必須包含 timestamp、metric、value。");
      }
      if (records.length - 1 > 50000) throw new Error("資料列超過 50,000 筆上限；請先縮小匯出範圍。");
      const accepted: MetricSample[] = [];
      let skipped = 0;
      let unsupported = 0;
      for (const row of records.slice(1)) {
        const timestamp = row[indexes.timestamp]?.trim() ?? "";
        const metric = row[indexes.metric]?.trim().toLowerCase() ?? "";
        const value = Number(row[indexes.value]?.trim());
        if (!Object.prototype.hasOwnProperty.call(METRICS, metric)) { unsupported += 1; continue; }
        const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
        if (!timestamp || !hasTimezone || !Number.isFinite(Date.parse(timestamp)) || row[indexes.value]?.trim() === "" || !Number.isFinite(value)) { skipped += 1; continue; }
        accepted.push({ timestamp: new Date(timestamp).toISOString(), metric, value });
      }
      if (accepted.length === 0) throw new Error("沒有可分析的有效 canonical 指標資料。請查看支援指標清單和欄位格式。");
      setSamples(accepted);
      setSkippedRows(skipped);
      setParseNote(`已在此瀏覽器讀取 ${accepted.length.toLocaleString()} 筆資料；${unsupported.toLocaleString()} 筆不支援的指標已略過。${skipped ? ` ${skipped} 筆無效值已略過。` : ""}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "讀取 CSV 失敗。請確認檔案格式。");
    }
  }

  function useDemoCsv() {
    const records = parseCsv(SAMPLE_CSV);
    const headers = records[0].map((header) => header.trim().toLowerCase());
    const timeIndex = headers.indexOf("timestamp");
    const metricIndex = headers.indexOf("metric");
    const valueIndex = headers.indexOf("value");
    const fixtureSamples = records.slice(1).map((row) => ({
      timestamp: new Date(row[timeIndex]).toISOString(),
      metric: row[metricIndex],
      value: Number(row[valueIndex]),
    }));
    setSamples(fixtureSamples);
    setSkippedRows(0);
    setError("");
    setParseNote("已載入內建合成 CSV 範例，非客戶資料；僅在此瀏覽器計算。");
  }

  const range = samples?.length ? {
    start: samples.reduce((min, sample) => sample.timestamp < min ? sample.timestamp : min, samples[0].timestamp),
    end: samples.reduce((max, sample) => sample.timestamp > max ? sample.timestamp : max, samples[0].timestamp),
  } : null;
  const format = (value: number, digits: number) => value.toLocaleString("zh-TW", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const gpuMetrics = summaries.filter((item) => item.group === "GPU");
  const inferenceMetrics = summaries.filter((item) => item.group === "vLLM");

  return (
    <section id="post-ingestion-analysis" className="surface panel workflow-panel analysis-panel">
      <div className="panel-heading workflow-heading">
        <div><div className="panel-title-row"><span className="panel-icon mint"><BarChart3 size={16} /></span><h2>導入後分析畫面</h2></div><p>可在本機分析標準化 CSV，或先用合成樣本試跑</p></div>
        <span className="demo-tag">本機唯讀分析</span>
      </div>
      <div className="analysis-warning"><CircleHelp size={15} /><span><b>這不是即時連線，也不會上傳檔案。</b>CSV 僅由目前瀏覽器讀取，留在記憶體直到離開／重新整理；不會保存、傳送或連接客戶系統。</span></div>
      <div className="analysis-import-bar">
        <input ref={fileInput} className="analysis-file-input" type="file" accept=".csv,text/csv" onChange={handleFileChange} aria-label="選擇 canonical metrics CSV" />
        <Button size="sm" onClick={() => fileInput.current?.click()}><FileUp size={14} />選擇 CSV 在本機分析</Button>
        <Button variant="outline" size="sm" onClick={useDemoCsv}><RefreshCw size={13} />載入合成範例</Button>
        <Button variant="outline" size="sm" onClick={() => downloadFile("gmi-metrics-sample.csv", SAMPLE_CSV, "text/csv;charset=utf-8") }><Download size={13} />下載 CSV 範例</Button>
      </div>
      {error && <div className="analysis-error" role="alert">{error}</div>}
      {parseNote && <div className="analysis-parse-note" role="status">{parseNote}</div>}
      <details className="csv-format-help">
        <summary>CSV 格式與支援指標</summary>
        <p>必填欄位：<code>timestamp,metric,value</code>；可附 <code>cluster_id,node,gpu_id,deployment,replica</code> 等欄位作來源整理（本頁不展示 labels）。時間請用含時區的 ISO-8601，例如 <code>2026-11-15T10:00:00Z</code>。支援以下 canonical 指標：</p>
        <div className="csv-metric-list">{Object.entries(METRICS).map(([key, definition]) => <code key={key}>{key} <span>· {definition.label}（{definition.unit}）</span></code>)}</div>
        <small>TTFT/ITL/TPOT 分位數請先由資料端以合併 histogram buckets 或核定查詢算好，再匯出對應 P50/P95 指標；不要將各 replica 的 quantile 直接平均。請先驗證來源版本與 label 聚合。</small>
      </details>
      {samples ? <>
        <div className="analysis-data-summary">
          <div><span>有效資料列</span><b>{samples.length.toLocaleString()}</b></div>
          <div><span>指標種類</span><b>{summaries.length}</b></div>
          <div><span>資料時間範圍（UTC）</span><b>{range ? `${range.start.slice(0, 16).replace("T", " ")} — ${range.end.slice(0, 16).replace("T", " ")}` : "未提供"}</b></div>
          {skippedRows > 0 && <div><span>無效值略過</span><b>{skippedRows}</b></div>}
        </div>
        {([ ["GPU 指標", gpuMetrics, Cpu], ["vLLM 推理指標", inferenceMetrics, Activity] ] as const).map(([title, items, Icon]) => (
          <div className="uploaded-analysis-group" key={title}>
            <h3><Icon size={14} />{title}</h3>
            {items.length ? <div className="uploaded-table-wrap"><table className="uploaded-metric-table"><thead><tr><th>指標</th><th>筆數</th><th>最新資料列（單一列）</th><th>平均</th><th>最小 / 最大</th></tr></thead><tbody>{items.map((item) => <tr key={item.key}>
              <td><b>{item.label}</b><small><code>{item.key}</code></small></td>
              <td>{item.count}</td>
              <td><b>{format(item.latest.value, item.digits ?? 1)} {item.unit}</b><small>{item.latest.timestamp.slice(0, 16).replace("T", " ")} UTC</small></td>
              <td>{format(item.mean, item.digits ?? 1)} {item.unit}</td>
              <td>{format(item.min, item.digits ?? 1)} / {format(item.max, item.digits ?? 1)} {item.unit}</td>
            </tr>)}</tbody></table></div> : <p className="analysis-empty">這份 CSV 沒有可用的此類指標。</p>}
          </div>
        ))}
        <div className="analysis-insight"><span className="insight-mark"><ShieldCheck size={15} /></span><div><b>如何解讀</b><p>表格的平均／最小／最大值是對匯入資料列做的描述性統計；若 CSV 混有多張 GPU 或多個 replica，平均值不自動代表正確的叢集／部署聚合。此工具不判斷健康、根因、告警或 SLO 違規；請先核實採集時間、單位、版本與 label 聚合方式。</p></div></div>
        <div className="analysis-reset-row"><span>所有結果僅存在本頁記憶體。</span><Button variant="outline" size="sm" onClick={() => { setSamples(null); setParseNote(""); setError(""); setSkippedRows(0); }}>清除本次資料</Button></div>
      </> : <>
        <div className="analysis-demo-tags" aria-label="合成分析類型">
          <span><Cpu size={14} />GPU 資源示意</span>
          <span><Activity size={14} />vLLM 指標在 CSV 載入後一併顯示</span>
        </div>
        <div className="analysis-content">
          <div className="analysis-metrics"><article><span>示範 GPU 平均使用率</span><b>{demo.gpuSummary.avgUtilization.value}%</b><small>合成 fixture · {demo.gpus.length} 張示範卡</small></article><article><span>示範 VRAM 平均使用</span><b>{demo.gpuSummary.avgVram.value}%</b><small>百分比不可跨卡相加</small></article><article><span>示範最高溫度</span><b>{demo.gpuSummary.maxTemperature.value}°C</b><small>溫度門檻未設定</small></article></div>
          <div className="analysis-insight"><span className="insight-mark blue"><CircleHelp size={15} /></span><div><b>目前顯示的是合成資料</b><p>載入 CSV 後會在上方顯示逐指標描述統計。正式分析仍需真實唯讀資料來源、確認過的版本與指標映射，以及客戶核定的 SLO；目前不能據此判斷叢集狀況。</p></div></div>
          <div className="analysis-mini-chart">{demo.gpus.map((gpu) => <div className="analysis-bar-row" key={gpu.id}><span>{gpu.id}</span><div><i style={{ width: `${gpu.utilization.value}%` }} /></div><b>{gpu.utilization.value}%</b></div>)}</div>
        </div>
      </>}
      <div className="analysis-footer"><span><i className="status-dot demo-dot" />CSV 僅本機讀取 · 未連真實 Prometheus API</span><span>不會保存、傳送或執行叢集操作</span></div>
    </section>
  );
}

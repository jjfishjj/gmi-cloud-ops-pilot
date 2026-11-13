export type DataStatus = "simulated" | "unavailable";

export type Metric<T extends number | string = number> = {
  value: T | null;
  unit: string;
  status: DataStatus;
  note?: string;
};

export type GpuSample = {
  id: string;
  node: string;
  model: string;
  health: "healthy" | "warning" | "unknown";
  utilization: Metric;
  vram: Metric;
  temperature: Metric;
};

export type AlertSample = {
  id: string;
  severity: "info" | "warning";
  title: string;
  summary: string;
  resource: string;
  sourceTime: string;
  threshold: string;
};

export const dashboardFixture = {
  isDemo: true,
  sourceLabel: "合成展示資料（fixture）",
  telemetryConnected: false,
  freshness: "不適用 — 尚未連接資料來源",
  customer: "示範客戶",
  cluster: {
    id: "demo-cluster-01",
    name: "Pilot Cluster · Demo",
    region: "未設定",
    gpuModel: "示範 GPU 型號",
    totalGpus: 8,
    healthyGpus: 8,
  },
  gpus: [
    { id: "GPU-01", node: "node-demo-01", model: "Demo GPU", health: "healthy", utilization: { value: 72, unit: "%", status: "simulated" }, vram: { value: 64, unit: "%", status: "simulated" }, temperature: { value: 61, unit: "°C", status: "simulated" } },
    { id: "GPU-02", node: "node-demo-01", model: "Demo GPU", health: "healthy", utilization: { value: 68, unit: "%", status: "simulated" }, vram: { value: 59, unit: "%", status: "simulated" }, temperature: { value: 60, unit: "°C", status: "simulated" } },
    { id: "GPU-03", node: "node-demo-02", model: "Demo GPU", health: "healthy", utilization: { value: 79, unit: "%", status: "simulated" }, vram: { value: 71, unit: "%", status: "simulated" }, temperature: { value: 66, unit: "°C", status: "simulated" } },
    { id: "GPU-04", node: "node-demo-02", model: "Demo GPU", health: "healthy", utilization: { value: 70, unit: "%", status: "simulated" }, vram: { value: 62, unit: "%", status: "simulated" }, temperature: { value: 63, unit: "°C", status: "simulated" } },
  ] satisfies GpuSample[],
  gpuSummary: {
    avgUtilization: { value: 72.4, unit: "%", status: "simulated" } satisfies Metric,
    avgVram: { value: 64, unit: "%", status: "simulated" } satisfies Metric,
    maxTemperature: { value: 66, unit: "°C", status: "simulated" } satisfies Metric,
  },
  deployment: {
    id: "demo-vllm-01",
    name: "vLLM · Demo Deployment",
    model: "Demo language model",
    engine: "vLLM · 示範版本（未核實）",
    replicas: 1,
    outputTokensPerSecond: { value: 1250, unit: "tokens/s", status: "simulated" } satisfies Metric,
    ttftP50: { value: 240, unit: "ms", status: "simulated" } satisfies Metric,
    ttftP95: { value: 430, unit: "ms", status: "simulated" } satisfies Metric,
    itlP50: { value: 25, unit: "ms", status: "simulated" } satisfies Metric,
    itlP95: { value: 42, unit: "ms", status: "simulated" } satisfies Metric,
    runningRequests: { value: 7, unit: "requests", status: "simulated" } satisfies Metric,
    waitingRequests: { value: 0, unit: "requests", status: "simulated" } satisfies Metric,
    kvCache: { value: 64, unit: "%", status: "simulated" } satisfies Metric,
    errorRate: { value: null, unit: "%", status: "unavailable", note: "尚未指定權威錯誤率來源" } satisfies Metric,
    sloStatus: "未設定",
  },
  alerts: [
    {
      id: "DEMO-ALERT-001",
      severity: "warning",
      title: "KV cache 使用率趨勢示例",
      summary: "這是用來演示告警詳情欄位的合成樣本，不代表實際事件或已核定門檻。",
      resource: "demo-vllm-01",
      sourceTime: "來源時間未提供（fixture）",
      threshold: "未設定",
    },
    {
      id: "DEMO-ALERT-002",
      severity: "info",
      title: "資料來源尚未連接",
      summary: "試點資料來源、採集頻率與告警平台仍待確認；目前不會執行查詢。",
      resource: "demo-cluster-01",
      sourceTime: "來源時間未提供（fixture）",
      threshold: "不適用",
    },
  ] satisfies AlertSample[],
} as const;

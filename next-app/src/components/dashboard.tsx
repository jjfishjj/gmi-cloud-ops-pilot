"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cpu,
  Gauge,
  LayoutDashboard,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  Waves,
} from "lucide-react";
import { dashboardFixture as data } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

const windows = ["6 小時", "24 小時", "7 天"] as const;
type WindowLabel = (typeof windows)[number];

function display(value: number | null, unit: string, digits = 0) {
  return value === null ? "未提供" : `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

export function Dashboard() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel>("24 小時");
  const [alertFilter, setAlertFilter] = useState<"全部" | "需檢視" | "資訊">("全部");
  const [notice, setNotice] = useState("");
  const alerts = useMemo(() => data.alerts.filter((alert) => {
    if (alertFilter === "需檢視") return alert.severity === "warning";
    if (alertFilter === "資訊") return alert.severity === "info";
    return true;
  }), [alertFilter]);

  function showDemoNotice() {
    setNotice("這是唯讀預覽；目前只顯示模擬 fixture，沒有連接或更新任何叢集資料。");
    window.setTimeout(() => setNotice(""), 3500);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="GMI Cloud pilot overview">
          <span className="brand-mark"><Network size={18} strokeWidth={1.7} /></span>
          <span className="brand-copy"><b>GMI CLOUD</b><small>AI INFRASTRUCTURE OPS</small></span>
        </a>
        <div className="side-label">PILOT WORKSPACE</div>
        <nav className="side-nav" aria-label="主要導覽">
          <a className="nav-item active" href="#overview"><LayoutDashboard size={16} /><span>營運總覽</span></a>
          <a className="nav-item" href="#gpu-health"><Cpu size={16} /><span>GPU 健康</span><span className="nav-tag">1</span></a>
          <a className="nav-item" href="#inference"><Activity size={16} /><span>推理服務</span></a>
          <a className="nav-item" href="#alerts"><Bell size={16} /><span>唯讀告警</span><span className="nav-tag subtle">{data.alerts.length}</span></a>
        </nav>
        <div className="side-spacer" />
        <div className="side-demo-card">
          <span className="status-line"><i className="status-dot demo-dot" />DEMO MODE</span>
          <p>資料來源尚未連接</p>
          <small>畫面數值皆為模擬 fixture，不代表實際遙測。</small>
        </div>
        <div className="side-footer"><span className="avatar">P</span><span><b>試點檢視</b><small>唯讀展示介面</small></span><ShieldCheck size={15} /></div>
      </aside>

      <main id="overview" className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>客戶工作區</span><span className="crumb-slash">/</span><b>叢集營運</b></div>
          <div className="top-actions">
            <Button variant="outline" size="sm" className="cluster-picker" onClick={showDemoNotice} aria-label="目前示範叢集">
              <span className="cluster-avatar">P</span><span>{data.cluster.name}</span><ChevronDown size={14} />
            </Button>
            <div className="top-divider" />
            <Button variant="outline" size="icon" className="icon-button" onClick={showDemoNotice} aria-label="重新顯示模擬資料"><RefreshCw size={15} /></Button>
            <Button variant="outline" size="icon" className="icon-button bell-button" onClick={() => document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth" })} aria-label="前往告警"><Bell size={15} /><i /></Button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow">CUSTOMER SUCCESS <span>·</span> GPU OPERATIONS</div>
            <h1>叢集營運總覽</h1>
            <p>一個客戶 · 一個 GPU 叢集 · 一個 vLLM 部署</p>
          </div>
          <div className="heading-meta"><span className="demo-pill"><i className="status-dot demo-dot" />展示模式 · 模擬資料</span></div>
        </section>

        <section className="notice-banner" aria-label="模擬資料通知">
          <span className="notice-icon"><CircleHelp size={16} /></span>
          <p><b>僅供介面預覽</b><span>此頁全部數值與告警皆為合成樣本；未連接真實客戶、叢集或 API。SLO 尚未設定。</span></p>
          <span className="notice-source">來源：{data.sourceLabel}</span>
        </section>

        <section className="cluster-context surface">
          <div className="context-icon"><Server size={17} /></div>
          <div className="context-copy"><span className="field-label">CUSTOMER / CLUSTER</span><b>{data.customer} <span className="context-sep">/</span> {data.cluster.name}</b></div>
          <div className="context-stat"><span className="field-label">GPU 型號</span><b>{data.cluster.gpuModel}</b></div>
          <div className="context-stat"><span className="field-label">區域</span><b>{data.cluster.region}</b></div>
          <div className="context-source"><span className="small-source-dot" />來源未連接</div>
        </section>

        <section className="metric-grid" aria-label="核心指標">
          <article className="metric-card surface">
            <div className="metric-top"><span>GPU 健康</span><span className="metric-icon mint"><ShieldCheck size={17} /></span></div>
            <div className="metric-value">{data.cluster.healthyGpus}<small> / {data.cluster.totalGpus}</small></div>
            <div className="metric-bottom"><span className="healthy-label"><i className="status-dot" />健康卡數 <em>（模擬）</em></span><span className="metric-foot">GPU inventory</span></div>
          </article>
          <article className="metric-card surface">
            <div className="metric-top"><span>GPU 平均使用率</span><span className="metric-icon blue"><Gauge size={17} /></span></div>
            <div className="metric-value">{display(data.gpuSummary.avgUtilization.value, "%", 1)}</div>
            <div className="metric-bottom"><span className="metric-foot">叢集平均 <em>· 模擬值</em></span><div className="mini-bar"><i style={{ width: `${data.gpuSummary.avgUtilization.value}%` }} /></div></div>
          </article>
          <article className="metric-card surface">
            <div className="metric-top"><span>GPU 最高溫度</span><span className="metric-icon amber"><Activity size={17} /></span></div>
            <div className="metric-value">{display(data.gpuSummary.maxTemperature.value, "°C")}</div>
            <div className="metric-bottom"><span className="metric-foot">門檻政策 <em>· 未設定</em></span><span className="metric-foot">模擬值</span></div>
          </article>
          <article className="metric-card surface">
            <div className="metric-top"><span>輸出吞吐量</span><span className="metric-icon mint"><Waves size={17} /></span></div>
            <div className="metric-value compact">{display(data.deployment.outputTokensPerSecond.value, "tokens/s")}</div>
            <div className="metric-bottom"><span className="metric-foot">單一 vLLM 部署</span><span className="metric-foot">模擬值</span></div>
          </article>
        </section>

        <section className="main-grid">
          <article id="gpu-health" className="surface panel gpu-panel">
            <div className="panel-heading">
              <div><div className="panel-title-row"><span className="panel-icon mint"><Cpu size={16} /></span><h2>GPU 健康與資源</h2></div><p>單卡狀態與叢集使用率摘要</p></div>
              <span className="demo-tag">SIMULATED</span>
            </div>
            <div className="chart-toolbar"><div className="chart-legend"><span><i className="legend-dot utilization" />GPU 使用率</span><span><i className="legend-dot memory" />VRAM 使用率</span></div>
              <div className="range-switch" role="group" aria-label="模擬趨勢時間範圍">{windows.map((item) => <button key={item} className={item === windowLabel ? "selected" : ""} aria-pressed={item === windowLabel} onClick={() => setWindowLabel(item)}>{item}</button>)}</div>
            </div>
            <div className="chart-area">
              <div className="y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
              <svg className="usage-chart" viewBox="0 0 640 178" preserveAspectRatio="none" role="img" aria-label={`${windowLabel} 模擬 GPU 使用率與 VRAM 趨勢`}>
                <defs><linearGradient id="fill-util" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4de0b1" stopOpacity=".23"/><stop offset="1" stopColor="#4de0b1" stopOpacity="0"/></linearGradient></defs>
                {[14, 52, 90, 128, 166].map((y) => <line key={y} x1="0" y1={y} x2="640" y2={y} className="chart-gridline" />)}
                <path d="M0 83 C35 75 42 86 72 78 S111 58 145 67 S184 80 218 64 S260 49 290 59 S329 75 360 58 S400 40 434 51 S475 68 508 48 S549 37 579 45 S612 54 640 35 L640 166 L0 166Z" fill="url(#fill-util)" />
                <path d="M0 83 C35 75 42 86 72 78 S111 58 145 67 S184 80 218 64 S260 49 290 59 S329 75 360 58 S400 40 434 51 S475 68 508 48 S549 37 579 45 S612 54 640 35" className="line-util" />
                <path d="M0 110 C35 105 48 114 72 108 S117 91 145 98 S188 105 218 91 S260 83 290 89 S331 103 360 88 S402 74 434 83 S473 95 508 78 S548 69 579 76 S615 83 640 66" className="line-memory" />
                {[0, 1, 2, 3, 4].map((i) => <text key={i} x={i * 160} y="177" className="chart-x-label">{["00", "06", "12", "18", "24"][i]}</text>)}
              </svg>
            </div>
            <div className="chart-caption"><span>{windowLabel} · 合成趨勢樣本，不代表實際時間序列</span><span>聚合：叢集平均（示意）</span></div>
            <div className="gpu-table-wrap">
              <table className="gpu-table">
                <thead><tr><th>GPU / 節點</th><th>健康狀態</th><th>使用率</th><th>VRAM</th><th>溫度</th></tr></thead>
                <tbody>{data.gpus.map((gpu) => <tr key={gpu.id}><td><b>{gpu.id}</b><small>{gpu.node}</small></td><td><span className="health-chip"><i className="status-dot" />健康 · 模擬</span></td><td>{display(gpu.utilization.value, "%")}</td><td>{display(gpu.vram.value, "%")}</td><td>{display(gpu.temperature.value, "°C")}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="panel-footnote"><span>僅列出 4 張示範 GPU · 無實際 inventory 接線</span><span>單位：百分比、°C</span></div>
          </article>

          <article id="inference" className="surface panel inference-panel">
            <div className="panel-heading">
              <div><div className="panel-title-row"><span className="panel-icon blue"><Activity size={16} /></span><h2>vLLM 推理效能</h2></div><p>單一 deployment · 唯讀觀測欄位</p></div>
              <span className="demo-tag">SIMULATED</span>
            </div>
            <div className="deployment-head"><span className="deployment-symbol">v</span><div><b>{data.deployment.name}</b><small>{data.deployment.model} <span>·</span> {data.deployment.replicas} replica</small></div><span className="deployment-state"><i className="status-dot demo-dot" />展示</span></div>
            <div className="inference-primary">
              <div className="big-inference"><span>輸出吞吐量</span><b>{data.deployment.outputTokensPerSecond.value?.toLocaleString()}<small> tokens/s</small></b><em>合成樣本</em></div>
              <div className="inference-secondary"><div><span>TTFT P50</span><b>{display(data.deployment.ttftP50.value, "ms")}</b></div><div><span>TTFT P95</span><b>{display(data.deployment.ttftP95.value, "ms")}</b></div><div><span>ITL P50 / P95</span><b>{data.deployment.itlP50.value} / {data.deployment.itlP95.value}<small> ms</small></b></div></div>
            </div>
            <div className="inference-stats">
              <div className="inference-stat"><span>執行中請求</span><b>{data.deployment.runningRequests.value}</b><small>模擬</small></div>
              <div className="inference-stat"><span>等待佇列</span><b>{data.deployment.waitingRequests.value}</b><small>模擬</small></div>
              <div className="inference-stat"><span>KV cache</span><b>{data.deployment.kvCache.value}%</b><small>模擬</small></div>
              <div className="inference-stat"><span>錯誤率</span><b className="unavailable">未提供</b><small>{data.deployment.errorRate.note}</small></div>
            </div>
            <div className="slo-callout"><span className="slo-icon"><Timer size={15} /></span><span><b>SLO 狀態：{data.deployment.sloStatus}</b><small>尚無客戶核定的 TTFT、ITL 或錯誤率目標；不推定 SLA 違規。</small></span><ArrowDownRight size={15} /></div>
            <div className="panel-footnote"><span>{data.deployment.engine}</span><span>來源時間未提供 · 模擬資料</span></div>
          </article>
        </section>

        <section id="alerts" className="surface panel alerts-panel">
          <div className="panel-heading alerts-heading">
            <div><div className="panel-title-row"><span className="panel-icon amber"><AlertTriangle size={16} /></span><h2>唯讀告警</h2><span className="count-badge">{alerts.length}</span></div><p>合成樣本 · 實際告警來源與門檻尚未確認</p></div>
            <div className="alert-filters" role="group" aria-label="篩選模擬告警">{(["全部", "需檢視", "資訊"] as const).map((item) => <button key={item} className={alertFilter === item ? "selected" : ""} aria-pressed={alertFilter === item} onClick={() => setAlertFilter(item)}>{item}</button>)}</div>
          </div>
          <div className="alert-list">{alerts.map((alert) => <details className="alert-row" key={alert.id}>
            <summary><span className={`alert-severity ${alert.severity}`}><i />{alert.severity === "warning" ? "示例" : "資訊"}</span><span className="alert-copy"><b>{alert.title}</b><small>{alert.summary}</small></span><span className="alert-resource">{alert.resource}</span><span className="alert-time"><Clock3 size={13} />來源時間未提供</span><span className="expand-mark">+</span></summary>
            <div className="alert-detail"><div><span>樣本 ID</span><b>{alert.id}</b></div><div><span>觀測值 / 門檻</span><b>未提供 / {alert.threshold}</b></div><div><span>來源時間</span><b>{alert.sourceTime}</b></div><div><span>交接方式</span><b>尚未設定 runbook 或支援連結</b></div></div>
          </details>)}</div>
          <div className="alert-readonly-note"><ShieldCheck size={14} />告警列表為唯讀；此原型沒有確認、結案、指派或修復操作。</div>
        </section>

        <footer className="page-footer"><span>GMI CLOUD · PILOT CLUSTER DASHBOARD</span><span><i className="footer-dot" />資料來源：{data.sourceLabel} <span className="footer-divider">·</span> 新鮮度：{data.freshness}</span></footer>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

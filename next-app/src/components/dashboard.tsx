"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ClipboardList,
  Copy,
  Cpu,
  Database,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
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
  const [analysisView, setAnalysisView] = useState<"gpu" | "inference">("gpu");
  const [readinessChecks, setReadinessChecks] = useState<boolean[]>([false, false, false, false, false, false]);
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

  async function copyConsultationList() {
    const text = [
      "GMI Cloud pilot 資料接線／導入前盤點（請勿附憑證、token、prompt 或真實請求本文）",
      "1. Pilot 範圍：單一客戶、一個 GPU 叢集、一個 vLLM deployment；GPU 型號／數量與 region。",
      "2. 指標儲存層：Prometheus 相容後端、版本、查詢 API 所在網路、保存期限與採集 cadence。",
      "3. GPU：是否有 DCGM Exporter；collector 欄位、GPU/node 對應與 exporter 版本。",
      "4. vLLM：實際版本與不含請求內容的 /metrics 範例；replica labels 與錯誤率權威來源。",
      "5. 告警與目標：既有告警平台／owner、runbook、核定的 SLO 與門檻；未核定者標記未設定。",
      "6. 安全：SSO/RBAC、唯讀權限、私有網路路徑、資料所在地與稽核政策。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已複製通用盤點提綱到剪貼簿；本頁沒有傳送或保存任何資料。");
    } catch {
      setNotice("無法存取剪貼簿。可依下方提綱逐項與平台工程師／TAM 盤點；本頁沒有傳送任何資料。");
    }
    window.setTimeout(() => setNotice(""), 4000);
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
          <a className="nav-item" href="#data-readiness"><Database size={16} /><span>資料接線準備</span></a>
          <a className="nav-item" href="#consultation"><ClipboardList size={16} /><span>導入前諮詢</span></a>
          <a className="nav-item" href="#post-ingestion-analysis"><BarChart3 size={16} /><span>導入後分析</span></a>
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

        <section className="pathway-strip" aria-label="資料導入流程">
          <a className="pathway-card surface" href="#data-readiness"><span className="pathway-step">01</span><span className="pathway-copy"><b><Database size={14} />先盤點資料來源</b><small>看接線架構、需求與權限</small></span><ArrowRight size={15} /></a>
          <a className="pathway-card surface" href="#consultation"><span className="pathway-step">02</span><span className="pathway-copy"><b><ClipboardList size={14} />導入前諮詢</b><small>帶著清單確認 pilot 條件</small></span><ArrowRight size={15} /></a>
          <a className="pathway-card surface" href="#post-ingestion-analysis"><span className="pathway-step">03</span><span className="pathway-copy"><b><BarChart3 size={14} />導入後看分析</b><small>先看合成樣本示範版</small></span><ArrowRight size={15} /></a>
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

        <section id="data-readiness" className="surface panel workflow-panel">
          <div className="panel-heading workflow-heading">
            <div><div className="panel-title-row"><span className="panel-icon mint"><Database size={16} /></span><h2>資料接線準備</h2></div><p>正式連線前先確認來源、網路邊界和唯讀權限</p></div>
            <span className="pending-tag">尚未連接</span>
          </div>
          <div className="source-grid">
            <article className="source-card"><div className="source-card-top"><span className="source-icon mint"><Cpu size={15} /></span><span className="pending-tag">待盤點</span></div><b>GPU 遙測 · DCGM Exporter</b><p>確認 exporter 版本、collector 欄位、GPU/node 對應與採樣頻率。</p><small>預計資料：利用率、VRAM、溫度、ECC</small></article>
            <article className="source-card"><div className="source-card-top"><span className="source-icon blue"><Activity size={15} /></span><span className="pending-tag">待盤點</span></div><b>推理指標 · vLLM /metrics</b><p>確認實際 vLLM 版本、指標名稱與 replica labels；不可假設範例版本相同。</p><small>預計資料：TPS、TTFT/ITL、queue、KV cache</small></article>
            <article className="source-card"><div className="source-card-top"><span className="source-icon amber"><Bell size={15} /></span><span className="pending-tag">待盤點</span></div><b>告警 · 既有告警來源</b><p>優先沿用 Alertmanager 或現有平台，並確認 owner、severity 與 runbook。</p><small>只讀呈現；不在此平台處理或修復</small></article>
          </div>
          <div className="architecture-flow" aria-label="建議資料流">
            <span>私有叢集來源</span><ArrowRight size={14} /><span>Prometheus 相容儲存</span><ArrowRight size={14} /><span>唯讀 BFF / API</span><ArrowRight size={14} /><span>儀表板</span>
          </div>
          <div className="readiness-bottom">
            <div className="readiness-checklist">
              <div className="checklist-heading"><b>接線前確認</b><span>{readinessChecks.filter(Boolean).length} / 6 已勾選</span></div>
              {[
                "試點範圍限一個客戶、一個叢集、一個 vLLM deployment",
                "已知 metrics backend、資料保留期與採集 cadence",
                "已盤點 DCGM Exporter 與 GPU / node 對應方式",
                "已取得不含請求本文的 vLLM /metrics 範例與版本",
                "已確認告警來源、owner、runbook 與核定 SLO（如有）",
                "已確認 SSO/RBAC、唯讀授權、私網路徑與資料政策",
              ].map((item, index) => <label className="checklist-item" key={item}><input type="checkbox" checked={readinessChecks[index]} onChange={() => setReadinessChecks((current) => current.map((checked, itemIndex) => itemIndex === index ? !checked : checked))} /><span>{item}</span></label>)}
            </div>
            <aside className="readiness-note"><span className="note-icon"><LockKeyhole size={15} /></span><b>瀏覽器不應直連叢集</b><p>正式設計由伺服器端唯讀 API 代理查詢；憑證留在伺服器端，來源保持私有，不接受任意 PromQL。</p><small>目前沒有接線 API 或安全收件後端。此區僅供盤點，不會傳送或保存。</small></aside>
          </div>
          <div className="workflow-actions"><span>勾選只保存在目前頁面記憶體；重新整理即清除。</span><Button variant="outline" size="sm" onClick={() => setReadinessChecks([false, false, false, false, false, false])}>清除勾選</Button></div>
        </section>

        <section id="consultation" className="surface panel workflow-panel consultation-panel">
          <div className="panel-heading workflow-heading">
            <div><div className="panel-title-row"><span className="panel-icon blue"><ClipboardList size={16} /></span><h2>導入前諮詢／盤點提綱</h2></div><p>先釐清最少必要條件，再決定如何接資料；不用先交出任何帳密</p></div>
            <span className="demo-tag">準備清單</span>
          </div>
          <div className="consultation-layout">
            <ol className="consultation-list">
              <li><b>範圍與來源</b><span>pilot 客戶／叢集／vLLM deployment、GPU 型號和 region；現有 Prometheus 相容儲存在哪裡？</span></li>
              <li><b>版本與樣本</b><span>DCGM Exporter、vLLM 版本及不含 prompt/請求本文的 metrics 樣本；採集 cadence 與保留期限。</span></li>
              <li><b>安全與權限</b><span>SSO/RBAC、誰能唯讀查看、伺服器到資料源的私網路徑、資料所在地與稽核政策。</span></li>
              <li><b>告警與目標</b><span>告警平台／owner／runbook，以及已核定的 TTFT、ITL、錯誤率或硬體門檻；未核定就標示「未設定」。</span></li>
            </ol>
            <aside className="consultation-callout"><span className="note-icon"><CircleHelp size={15} /></span><b>目前沒有線上諮詢收件表單</b><p>這個 GitHub Pages 示範站沒有後端收件功能。可先複製通用提綱，和你的 GMI Cloud 聯絡窗口／平台工程師私下確認；不要在公開頁貼上真實客戶資料。</p><Button onClick={copyConsultationList}><Copy size={14} />複製諮詢提綱</Button></aside>
          </div>
          <div className="security-reminder"><LockKeyhole size={14} /><span>請勿輸入或分享密碼、token、私鑰、客戶 prompt、請求本文或其他敏感 payload。</span></div>
        </section>

        <section id="post-ingestion-analysis" className="surface panel workflow-panel analysis-panel">
          <div className="panel-heading workflow-heading">
            <div><div className="panel-title-row"><span className="panel-icon mint"><BarChart3 size={16} /></span><h2>導入後分析畫面</h2></div><p>示範接線成功後如何解讀 GPU 與 vLLM 指標</p></div>
            <span className="demo-tag">合成樣本 · 非真實分析</span>
          </div>
          <div className="analysis-warning"><CircleHelp size={15} /><span><b>目前沒有匯入、上傳或保存功能。</b>下方只用既有合成 fixture 示範分析版型；不會讀取本機檔案或連到客戶系統。</span></div>
          <div className="analysis-tabs" role="tablist" aria-label="選擇示範分析類型">
            <button role="tab" aria-selected={analysisView === "gpu"} className={analysisView === "gpu" ? "selected" : ""} onClick={() => setAnalysisView("gpu")}><Cpu size={14} />GPU 資源分析</button>
            <button role="tab" aria-selected={analysisView === "inference"} className={analysisView === "inference" ? "selected" : ""} onClick={() => setAnalysisView("inference")}><Activity size={14} />vLLM 推理分析</button>
          </div>
          {analysisView === "gpu" ? <div className="analysis-content" role="tabpanel">
            <div className="analysis-metrics"><article><span>示範 GPU 平均使用率</span><b>{data.gpuSummary.avgUtilization.value}%</b><small>合成 fixture · 4 張示範卡</small></article><article><span>示範 VRAM 平均使用</span><b>{data.gpuSummary.avgVram.value}%</b><small>百分比不可跨卡相加</small></article><article><span>示範最高溫度</span><b>{data.gpuSummary.maxTemperature.value}°C</b><small>溫度門檻未設定</small></article></div>
            <div className="analysis-insight"><span className="insight-mark"><Check size={15} /></span><div><b>可觀察的示範結果</b><p>樣本卡的使用率落在 68–79%，最高溫為 66°C。正式報告需附上時間戳、資料新鮮度、聚合方式與客戶確認的溫度政策；目前不能據此宣稱叢集健康或判斷異常根因。</p></div></div>
            <div className="analysis-mini-chart">{data.gpus.map((gpu) => <div className="analysis-bar-row" key={gpu.id}><span>{gpu.id}</span><div><i style={{ width: `${gpu.utilization.value}%` }} /></div><b>{gpu.utilization.value}%</b></div>)}</div>
          </div> : <div className="analysis-content" role="tabpanel">
            <div className="analysis-metrics"><article><span>輸出吞吐量</span><b>{data.deployment.outputTokensPerSecond.value?.toLocaleString()} <small>tokens/s</small></b><small>合成 fixture</small></article><article><span>TTFT P95</span><b>{data.deployment.ttftP95.value} <small>ms</small></b><small>SLO 未設定</small></article><article><span>等待佇列</span><b>{data.deployment.waitingRequests.value}</b><small>合成 fixture</small></article></div>
            <div className="analysis-insight"><span className="insight-mark blue"><Activity size={15} /></span><div><b>解讀限制</b><p>樣本展示了吞吐、TTFT 與等待佇列；錯誤率來源未提供，客戶 SLO 亦未設定。接線後須先核對 vLLM 版本與 metrics 語義，不把缺值當成 0，也不推定 SLA 違規。</p></div></div>
            <div className="analysis-data-row"><span>待接資料</span><b>vLLM /metrics · API gateway 錯誤率 · 核定 SLO</b><span>結論</span><b>目前僅能展示讀數格式，未做真實客戶診斷</b></div>
          </div>}
          <div className="analysis-footer"><span><i className="status-dot demo-dot" />合成 fixture · 來源時間未提供 · 非營運建議</span><span>正式分析需真實唯讀 API 與經確認的指標映射</span></div>
        </section>

        <footer className="page-footer"><span>GMI CLOUD · PILOT CLUSTER DASHBOARD</span><span><i className="footer-dot" />資料來源：{data.sourceLabel} <span className="footer-divider">·</span> 新鮮度：{data.freshness}</span></footer>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

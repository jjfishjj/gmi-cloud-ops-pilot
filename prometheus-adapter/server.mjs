import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";

const MAX_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const MAX_METRICS_PER_REQUEST = 8;
const MAX_TOTAL_SERIES = 100;
const MAX_TOTAL_POINTS = 20_000;
const MAX_UPSTREAM_BODY_BYTES = 5 * 1024 * 1024;
const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const CLUSTER_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;
const WINDOW_PATTERN = /^(\d+(?:\.\d+)?)(s|m|h)$/;

const metricSpecs = [
  { name: "gpu_utilization_pct", env: "PROMETHEUS_GPU_UTILIZATION_METRIC", fallback: "DCGM_FI_DEV_GPU_UTIL", unit: "%", aggregation: "per-series gauge", kind: "gauge", multiplier: 1 },
  { name: "gpu_vram_used_bytes", env: "PROMETHEUS_GPU_VRAM_USED_METRIC", fallback: "DCGM_FI_DEV_FB_USED", unit: "bytes", aggregation: "per-series gauge; source unit normalized", kind: "gauge", multiplier: 1 },
  { name: "gpu_temperature_celsius", env: "PROMETHEUS_GPU_TEMPERATURE_METRIC", fallback: "DCGM_FI_DEV_GPU_TEMP", unit: "°C", aggregation: "per-series gauge", kind: "gauge", multiplier: 1 },
  { name: "gpu_power_watts", env: "PROMETHEUS_GPU_POWER_METRIC", fallback: "DCGM_FI_DEV_POWER_USAGE", unit: "W", aggregation: "per-series gauge", kind: "gauge", multiplier: 1 },
  { name: "gpu_ecc_dbe_total", env: "PROMETHEUS_GPU_ECC_DBE_METRIC", fallback: "DCGM_FI_DEV_ECC_DBE_VOL_TOTAL", unit: "errors", aggregation: "raw counter; source reset semantics retained", kind: "counter", multiplier: 1 },
  { name: "gpu_ecc_sbe_total", env: "PROMETHEUS_GPU_ECC_SBE_METRIC", fallback: "DCGM_FI_DEV_ECC_SBE_VOL_TOTAL", unit: "errors", aggregation: "raw counter; source reset semantics retained", kind: "counter", multiplier: 1 },
  { name: "inference_output_tokens_per_second", env: "PROMETHEUS_OUTPUT_TOKENS_METRIC", fallback: "vllm:generation_tokens_total", unit: "tokens/s", aggregation: "per-series rate over 5m", kind: "rate", multiplier: 1 },
  { name: "inference_requests_per_second", env: "PROMETHEUS_REQUESTS_METRIC", fallback: "vllm:request_success_total", unit: "requests/s", aggregation: "per-series rate over 5m", kind: "rate", multiplier: 1 },
  { name: "inference_ttft_seconds", env: "PROMETHEUS_TTFT_HISTOGRAM", fallback: "vllm:time_to_first_token_seconds", unit: "seconds", aggregation: "deployment histogram quantiles P50/P95", kind: "histogram", multiplier: 1 },
  { name: "inference_itl_seconds", env: "PROMETHEUS_ITL_HISTOGRAM", fallback: "vllm:inter_token_latency_seconds", unit: "seconds", aggregation: "deployment histogram quantiles P50/P95", kind: "histogram", multiplier: 1 },
  { name: "inference_tpot_seconds", env: "PROMETHEUS_TPOT_HISTOGRAM", fallback: "vllm:request_time_per_output_token_seconds", unit: "seconds", aggregation: "deployment histogram quantiles P50/P95; distinct from ITL", kind: "histogram", multiplier: 1 },
  { name: "inference_running_requests", env: "PROMETHEUS_RUNNING_REQUESTS_METRIC", fallback: "vllm:num_requests_running", unit: "requests", aggregation: "per-series gauge", kind: "gauge", multiplier: 1 },
  { name: "inference_waiting_requests", env: "PROMETHEUS_WAITING_REQUESTS_METRIC", fallback: "vllm:num_requests_waiting", unit: "requests", aggregation: "per-series gauge", kind: "gauge", multiplier: 1 },
  { name: "inference_kv_cache_used_pct", env: "PROMETHEUS_KV_CACHE_METRIC", fallback: "vllm:kv_cache_usage_perc", unit: "%", aggregation: "per-series gauge; source ratio converted to percent", kind: "gauge", multiplier: 100 },
];

export class AdapterError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function integerEnv(env, name, fallback, min, max) {
  const raw = env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} is outside the allowed range.`);
  return value;
}

function safePrometheusMetricName(value, envName) {
  if (!METRIC_NAME_PATTERN.test(value)) throw new Error(`${envName} must be a Prometheus metric identifier.`);
  return value;
}

export function loadConfig(env = process.env) {
  const upstreamRaw = env.PROMETHEUS_URL;
  const token = env.DASHBOARD_API_TOKEN;
  const clusterId = env.PROMETHEUS_CLUSTER_ID;
  if (!upstreamRaw || !token || !clusterId) {
    throw new Error("Set PROMETHEUS_URL, PROMETHEUS_CLUSTER_ID, and DASHBOARD_API_TOKEN before starting the adapter.");
  }
  if (token.length < 24) throw new Error("DASHBOARD_API_TOKEN must contain at least 24 characters.");
  if (!CLUSTER_ID_PATTERN.test(clusterId)) throw new Error("PROMETHEUS_CLUSTER_ID contains unsupported characters.");

  const upstream = new URL(upstreamRaw);
  if (!(upstream.protocol === "https:" || upstream.protocol === "http:") || upstream.username || upstream.password || upstream.search || upstream.hash) {
    throw new Error("PROMETHEUS_URL must be an HTTP(S) base URL without embedded credentials, query, or fragment.");
  }
  const upstreamPath = upstream.pathname.replace(/\/+$/, "");

  const clusterLabel = env.PROMETHEUS_CLUSTER_LABEL ?? "cluster";
  if (!LABEL_NAME_PATTERN.test(clusterLabel)) throw new Error("PROMETHEUS_CLUSTER_LABEL is invalid.");

  const vramUnit = env.PROMETHEUS_GPU_VRAM_USED_UNIT ?? "MiB";
  if (vramUnit !== "MiB" && vramUnit !== "bytes") throw new Error("PROMETHEUS_GPU_VRAM_USED_UNIT must be MiB or bytes.");
  const vramMultiplier = vramUnit === "MiB" ? 1_048_576 : 1;
  const kvCacheSourceUnit = env.PROMETHEUS_KV_CACHE_SOURCE_UNIT ?? "ratio";
  if (kvCacheSourceUnit !== "ratio" && kvCacheSourceUnit !== "percent") throw new Error("PROMETHEUS_KV_CACHE_SOURCE_UNIT must be ratio or percent.");

  const metrics = new Map();
  for (const spec of metricSpecs) {
    const rawSourceName = Object.hasOwn(env, spec.env) ? env[spec.env] : spec.fallback;
    const sourceName = rawSourceName === "" ? null : safePrometheusMetricName(rawSourceName, spec.env);
    const multiplier = spec.name === "gpu_vram_used_bytes" ? vramMultiplier
      : spec.name === "inference_kv_cache_used_pct" && kvCacheSourceUnit === "ratio" ? 100
        : spec.multiplier;
    metrics.set(spec.name, { ...spec, sourceName, multiplier });
  }

  const labelAllowlist = (env.PROMETHEUS_LABEL_ALLOWLIST ?? "gpu,gpu_id,gpu_uuid,UUID,node,hostname,model,model_name,replica")
    .split(",").map((label) => label.trim()).filter(Boolean);
  if (labelAllowlist.some((label) => !LABEL_NAME_PATTERN.test(label))) throw new Error("PROMETHEUS_LABEL_ALLOWLIST contains an invalid label name.");
  const dashboardOrigin = env.DASHBOARD_ORIGIN || null;
  if (dashboardOrigin) {
    const parsedOrigin = new URL(dashboardOrigin);
    if (parsedOrigin.origin !== dashboardOrigin || !(parsedOrigin.protocol === "https:" || parsedOrigin.hostname === "localhost")) {
      throw new Error("DASHBOARD_ORIGIN must be an exact HTTPS origin (HTTP is allowed only for localhost).");
    }
  }

  return {
    upstream,
    upstreamPath,
    prometheusToken: env.PROMETHEUS_BEARER_TOKEN || null,
    dashboardToken: token,
    clusterId,
    clusterLabel,
    scrapeIntervalSeconds: integerEnv(env, "PROMETHEUS_SCRAPE_INTERVAL_SECONDS", 30, 1, 3600),
    timeoutMs: integerEnv(env, "PROMETHEUS_TIMEOUT_MS", 8000, 500, 30000),
    maxRequestsPerMinute: integerEnv(env, "ADAPTER_REQUESTS_PER_MINUTE", 60, 1, 600),
    labelAllowlist: new Set(labelAllowlist.filter((label) => label !== clusterLabel)),
    dashboardOrigin,
    metrics,
  };
}

function safeEqual(left, right) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function makeQuery(definition, clusterSelector, quantile) {
  if (definition.kind === "rate") return `rate(${definition.sourceName}${clusterSelector}[5m])`;
  if (definition.kind === "histogram") {
    return `histogram_quantile(${quantile}, sum by (le) (rate(${definition.sourceName}_bucket${clusterSelector}[5m])))`;
  }
  return `${definition.sourceName}${clusterSelector}`;
}

function parseTime(value, field) {
  if (!value) throw new AdapterError(400, "INVALID_RANGE", `Missing ${field}.`);
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds > 8_640_000_000) throw new AdapterError(400, "INVALID_RANGE", `Invalid ${field}.`);
    return Math.round(seconds * 1000);
  }
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoPattern.test(value)) throw new AdapterError(400, "INVALID_RANGE", `${field} must be Unix seconds or an RFC3339 timestamp with timezone.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new AdapterError(400, "INVALID_RANGE", `Invalid ${field}.`);
  return parsed;
}

function parseStep(value, rangeSeconds) {
  if (!value) return Math.max(15, Math.ceil(rangeSeconds / 1000));
  const match = WINDOW_PATTERN.exec(value);
  if (!match) throw new AdapterError(400, "INVALID_RANGE", "step must be an interval such as 30s, 1m, or 1h.");
  const factor = match[2] === "s" ? 1 : match[2] === "m" ? 60 : 3600;
  const seconds = Number(match[1]) * factor;
  if (!Number.isFinite(seconds) || seconds < 15 || seconds > 3600) throw new AdapterError(400, "INVALID_RANGE", "step must be between 15 seconds and 1 hour.");
  return seconds;
}

function parseRange(searchParams, nowMs) {
  const startMs = parseTime(searchParams.get("start"), "start");
  const endMs = parseTime(searchParams.get("end"), "end");
  if (endMs <= startMs || endMs > nowMs + 60_000) throw new AdapterError(400, "INVALID_RANGE", "end must be after start and no more than 60 seconds in the future.");
  const rangeSeconds = (endMs - startMs) / 1000;
  if (rangeSeconds > MAX_WINDOW_SECONDS) throw new AdapterError(400, "INVALID_RANGE", "The maximum query range is 7 days.");
  const stepSeconds = parseStep(searchParams.get("step"), rangeSeconds);
  if (Math.ceil(rangeSeconds / stepSeconds) + 1 > 10_000) throw new AdapterError(400, "INVALID_RANGE", "This query would return too many time points; increase step.");
  return { startMs, endMs, stepSeconds };
}

function secondsText(ms) {
  return (ms / 1000).toFixed(3).replace(/\.?(?:0+)$/, "");
}

async function readLimitedJson(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BODY_BYTES) {
    throw new AdapterError(502, "UPSTREAM_LIMIT_EXCEEDED", "Prometheus response exceeded the adapter size limit.");
  }
  if (!response.body) throw new AdapterError(502, "UPSTREAM_UNAVAILABLE", "Prometheus returned an empty response.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPSTREAM_BODY_BYTES) {
        await reader.cancel();
        throw new AdapterError(502, "UPSTREAM_LIMIT_EXCEEDED", "Prometheus response exceeded the adapter size limit.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdapterError(502, "UPSTREAM_UNAVAILABLE", "Prometheus returned an invalid response.");
  }
}

function sanitizeLabels(labels, allowlist, clusterLabel, extra = {}) {
  const result = {};
  for (const label of allowlist) {
    if (label !== clusterLabel && typeof labels?.[label] === "string") result[label] = labels[label];
  }
  return { ...result, ...extra };
}

async function queryPrometheus(config, query, range, fetchImpl) {
  const url = new URL(config.upstream.origin);
  url.pathname = `${config.upstreamPath}/api/v1/query_range`;
  url.searchParams.set("query", query);
  url.searchParams.set("start", secondsText(range.startMs));
  url.searchParams.set("end", secondsText(range.endMs));
  url.searchParams.set("step", `${range.stepSeconds}s`);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(config.prometheusToken ? { Authorization: `Bearer ${config.prometheusToken}` } : {}),
      },
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AdapterError(504, "UPSTREAM_TIMEOUT", "Prometheus did not respond before the timeout.");
    }
    throw new AdapterError(502, "UPSTREAM_UNAVAILABLE", "Prometheus is unavailable.");
  }
  if (!response.ok) throw new AdapterError(502, "UPSTREAM_UNAVAILABLE", "Prometheus rejected the read-only query.");
  const payload = await readLimitedJson(response);
  if (payload?.status !== "success" || payload?.data?.resultType !== "matrix" || !Array.isArray(payload?.data?.result)) {
    throw new AdapterError(502, "UPSTREAM_UNAVAILABLE", "Prometheus returned an unsupported response.");
  }
  if (payload.data.result.length > MAX_TOTAL_SERIES) throw new AdapterError(502, "UPSTREAM_LIMIT_EXCEEDED", "Prometheus returned too many series.");
  return payload.data.result;
}

function extractSeries(result, definition, config, extraLabels = {}) {
  return result.map((series) => ({
    labels: sanitizeLabels(series.metric, config.labelAllowlist, config.clusterLabel, extraLabels),
    points: Array.isArray(series.values) ? series.values.flatMap((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return [];
      const timestampMs = Number(pair[0]) * 1000;
      const value = Number(pair[1]) * definition.multiplier;
      if (!Number.isFinite(timestampMs) || !Number.isFinite(value)) return [];
      return [{ timestamp: new Date(timestampMs).toISOString(), value }];
    }) : [],
  }));
}

function errorResponse(error, requestId) {
  const apiError = error instanceof AdapterError ? error : new AdapterError(500, "INTERNAL_ERROR", "The adapter could not complete the request.");
  return {
    status: apiError.status,
    body: { error: { code: apiError.code, message: apiError.message, requestId } },
  };
}

export function createServer({ config = loadConfig(), fetchImpl = fetch, now = () => Date.now() } = {}) {
  const requestCounts = new Map();
  const server = createHttpServer(async (req, res) => {
    const requestId = randomUUID();
    const headers = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    };
    const origin = req.headers.origin;
    if (config.dashboardOrigin && origin === config.dashboardOrigin) {
      headers["Access-Control-Allow-Origin"] = config.dashboardOrigin;
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
      headers.Vary = "Origin";
    }
    const send = (status, payload) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(payload));
    };
    const url = new URL(req.url ?? "/", "http://adapter.local");

    if (req.method === "OPTIONS") {
      if (!config.dashboardOrigin || origin !== config.dashboardOrigin) return send(403, { error: { code: "FORBIDDEN", message: "Origin is not allowed.", requestId } });
      res.writeHead(204, headers);
      return res.end();
    }
    if (url.pathname === "/healthz") {
      if (req.method !== "GET") return send(405, { error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported.", requestId } });
      return send(200, { data: { service: "prometheus-readonly-adapter", status: "ok" } });
    }
    if (req.method !== "GET") {
      headers.Allow = "GET";
      req.resume();
      return send(405, { error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported.", requestId } });
    }

    const address = req.socket.remoteAddress ?? "unknown";
    const nowMs = now();
    const bucket = requestCounts.get(address);
    if (!bucket || nowMs - bucket.startedAt >= 60_000) requestCounts.set(address, { startedAt: nowMs, count: 1 });
    else if (bucket.count >= config.maxRequestsPerMinute) return send(429, { error: { code: "RATE_LIMITED", message: "Request rate limit exceeded.", requestId } });
    else bucket.count += 1;
    if (requestCounts.size > 5000) {
      for (const [key, value] of requestCounts) if (nowMs - value.startedAt >= 60_000) requestCounts.delete(key);
      while (requestCounts.size > 5000) requestCounts.delete(requestCounts.keys().next().value);
    }

    const isMetricsRoute = /^\/api\/v1\/clusters\/[^/]+\/metrics$/.test(url.pathname);
    if (!isMetricsRoute) return send(404, { error: { code: "NOT_FOUND", message: "Endpoint not found.", requestId } });

    const authorization = req.headers.authorization ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match || !safeEqual(match[1], config.dashboardToken)) {
      return send(401, { error: { code: "UNAUTHENTICATED", message: "Valid dashboard authorization is required.", requestId } });
    }

    try {
      const encodedClusterId = url.pathname.split("/")[4];
      let requestedClusterId;
      try { requestedClusterId = decodeURIComponent(encodedClusterId); } catch {
        throw new AdapterError(400, "INVALID_CLUSTER", "Cluster ID is invalid.");
      }
      if (!CLUSTER_ID_PATTERN.test(requestedClusterId)) throw new AdapterError(400, "INVALID_CLUSTER", "Cluster ID is invalid.");
      if (requestedClusterId !== config.clusterId) throw new AdapterError(404, "NOT_FOUND", "Cluster not found.");

      const requestedNames = url.searchParams.getAll("names").flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
      if (requestedNames.length < 1 || requestedNames.length > MAX_METRICS_PER_REQUEST || new Set(requestedNames).size !== requestedNames.length) {
        throw new AdapterError(400, "INVALID_METRIC_REQUEST", `Request between 1 and ${MAX_METRICS_PER_REQUEST} distinct metric names.`);
      }
      const definitions = requestedNames.map((name) => {
        const definition = config.metrics.get(name);
        if (!definition) throw new AdapterError(400, "UNSUPPORTED_METRIC", `Metric '${name}' is not in the canonical allowlist.`);
        if (!definition.sourceName) throw new AdapterError(400, "METRIC_NOT_CONFIGURED", `Metric '${name}' has no configured source mapping.`);
        return definition;
      });
      const range = parseRange(url.searchParams, nowMs);
      const selector = `{${config.clusterLabel}="${config.clusterId}"}`;
      const work = definitions.flatMap((definition) => definition.kind === "histogram"
        ? [{ definition, quantile: 0.5 }, { definition, quantile: 0.95 }]
        : [{ definition, quantile: null }]);
      const results = new Array(work.length);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(4, work.length) }, async () => {
        while (true) {
          const index = cursor++;
          if (index >= work.length) return;
          const item = work[index];
          const query = makeQuery(item.definition, selector, item.quantile);
          const raw = await queryPrometheus(config, query, range, fetchImpl);
          results[index] = extractSeries(raw, item.definition, config, item.quantile === null ? {} : { quantile: item.quantile === 0.5 ? "p50" : "p95" });
        }
      });
      await Promise.all(workers);

      let seriesCount = 0;
      let pointCount = 0;
      const metrics = definitions.map((definition) => {
        const subresults = work.filter((item) => item.definition === definition).map((item) => results[work.indexOf(item)]);
        const series = subresults.flat();
        seriesCount += series.length;
        for (const item of series) pointCount += item.points.length;
        if (seriesCount > MAX_TOTAL_SERIES || pointCount > MAX_TOTAL_POINTS) {
          throw new AdapterError(502, "UPSTREAM_LIMIT_EXCEEDED", "Prometheus result exceeded the adapter series or point limit.");
        }
        if (definition.kind !== "histogram") {
          const seen = new Set();
          for (const item of series) {
            const key = JSON.stringify(item.labels);
            if (seen.has(key)) throw new AdapterError(502, "AMBIGUOUS_SERIES", "The source returned series that differ only by labels not approved for display.");
            seen.add(key);
          }
        }
        return { name: definition.name, unit: definition.unit, aggregation: definition.aggregation, series };
      });

      let latestSampleMs = null;
      for (const metric of metrics) for (const series of metric.series) for (const point of series.points) {
        const timestampMs = Date.parse(point.timestamp);
        if (latestSampleMs === null || timestampMs > latestSampleMs) latestSampleMs = timestampMs;
      }
      const freshnessSeconds = latestSampleMs === null ? null : Math.max(0, Math.floor((nowMs - latestSampleMs) / 1000));
      const stale = freshnessSeconds === null ? null : freshnessSeconds > config.scrapeIntervalSeconds * 2;
      return send(200, {
        data: { clusterId: config.clusterId, metrics },
        meta: {
          asOf: new Date(nowMs).toISOString(),
          latestSampleAt: latestSampleMs === null ? null : new Date(latestSampleMs).toISOString(),
          freshnessSeconds,
          stale,
          hasData: latestSampleMs !== null,
          scrapeIntervalSeconds: config.scrapeIntervalSeconds,
        },
      });
    } catch (error) {
      const result = errorResponse(error, requestId);
      if (result.status >= 500) console.error(JSON.stringify({ event: "adapter_request_failed", requestId, code: result.body.error.code }));
      return send(result.status, result.body);
    }
  });
  return server;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer from 1 to 65535.");
    process.exit(1);
  }
  const server = createServer({ config });
  server.listen(port, host, () => console.log(`Prometheus read-only adapter listening on ${host}:${port}`));
}

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, loadConfig } from "./server.mjs";

const fixedNow = Date.parse("2026-11-16T11:00:00.000Z");
const dashboardToken = "test-dashboard-adapter-token-0123456789";
const requestHeaders = { Authorization: `Bearer ${dashboardToken}` };
const baseEnv = {
  PROMETHEUS_URL: "http://prometheus.internal:9090",
  PROMETHEUS_CLUSTER_ID: "pilot-01",
  PROMETHEUS_CLUSTER_LABEL: "cluster",
  PROMETHEUS_SCRAPE_INTERVAL_SECONDS: "30",
  PROMETHEUS_GPU_VRAM_USED_UNIT: "bytes",
  DASHBOARD_API_TOKEN: dashboardToken,
};

let server;
let baseUrl;
let queries;
let fetchImpl;
let responseTimestamp;
let fetchMode;

before(async () => {
  queries = [];
  responseTimestamp = fixedNow / 1000 - 10;
  fetchMode = "success";
  fetchImpl = async (input, options) => {
    const url = new URL(input);
    queries.push({ url, options });
    if (fetchMode === "timeout") {
      const error = new Error("private upstream detail");
      error.name = "TimeoutError";
      throw error;
    }
    if (fetchMode === "network-error") throw new Error("private upstream detail");
    if (fetchMode === "http-error") return new Response("private upstream detail", { status: 503 });
    const result = url.searchParams.get("query")?.includes("histogram_quantile")
      ? [{ metric: {}, values: [[responseTimestamp, "0.025"]] }]
      : [{ metric: { cluster: "pilot-01", gpu: "0", node: "node-01" }, values: [[responseTimestamp, "0"]] }];
    return new Response(JSON.stringify({ status: "success", data: { resultType: "matrix", result } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  server = createServer({ config: loadConfig(baseEnv), fetchImpl, now: () => fixedNow });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function metricsUrl(query = "names=gpu_utilization_pct&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z&step=1m") {
  return `${baseUrl}/api/v1/clusters/pilot-01/metrics?${query}`;
}

test("serves a zero-valued sample without confusing it with missing data", async () => {
  queries = [];
  responseTimestamp = fixedNow / 1000 - 10;
  const response = await fetch(metricsUrl(), { headers: requestHeaders });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.metrics[0].series[0].points[0].value, 0);
  assert.equal(body.meta.hasData, true);
  assert.equal(body.meta.stale, false);
  assert.equal(body.data.metrics[0].series[0].labels.gpu, "0");
  assert.equal(body.data.metrics[0].series[0].labels.cluster, undefined);
  assert.match(queries[0].url.searchParams.get("query"), /^DCGM_FI_DEV_GPU_UTIL\{cluster="pilot-01"\}$/);
  assert.equal(queries[0].url.pathname, "/api/v1/query_range");
});

test("marks old samples stale and leaves an empty result distinct from numeric zero", async () => {
  responseTimestamp = fixedNow / 1000 - 61;
  let response = await fetch(metricsUrl(), { headers: requestHeaders });
  let body = await response.json();
  assert.equal(body.meta.stale, true);
  assert.equal(body.meta.hasData, true);

  fetchImpl = async () => new Response(JSON.stringify({ status: "success", data: { resultType: "matrix", result: [] } }), { status: 200 });
  server.close();
  server = createServer({ config: loadConfig(baseEnv), fetchImpl, now: () => fixedNow });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  response = await fetch(metricsUrl(), { headers: requestHeaders });
  body = await response.json();
  assert.equal(body.meta.hasData, false);
  assert.equal(body.meta.freshnessSeconds, null);
  assert.equal(body.meta.stale, null);
  assert.deepEqual(body.data.metrics[0].series, []);
});

test("uses fixed server-side counter and histogram templates", async () => {
  fetchImpl = async (input) => {
    const url = new URL(input);
    queries.push(url.searchParams.get("query"));
    return new Response(JSON.stringify({ status: "success", data: { resultType: "matrix", result: [{ metric: {}, values: [[fixedNow / 1000 - 10, "0.1"]] }] } }), { status: 200 });
  };
  server.close();
  server = createServer({ config: loadConfig(baseEnv), fetchImpl, now: () => fixedNow });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  queries = [];
  const response = await fetch(metricsUrl("names=inference_output_tokens_per_second,inference_ttft_seconds&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z&step=1m"), { headers: requestHeaders });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(queries.includes('rate(vllm:generation_tokens_total{cluster="pilot-01"}[5m])'));
  assert.ok(queries.includes('histogram_quantile(0.5, sum by (le) (rate(vllm:time_to_first_token_seconds_bucket{cluster="pilot-01"}[5m])))'));
  assert.ok(queries.includes('histogram_quantile(0.95, sum by (le) (rate(vllm:time_to_first_token_seconds_bucket{cluster="pilot-01"}[5m])))'));
  const histogram = body.data.metrics.find((metric) => metric.name === "inference_ttft_seconds");
  assert.deepEqual(histogram.series.map((series) => series.labels.quantile).sort(), ["p50", "p95"]);
});

test("requires authorization and rejects unapproved metrics without querying upstream", async () => {
  queries = [];
  let response = await fetch(metricsUrl());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHENTICATED");

  response = await fetch(metricsUrl("names=up&query=up%20or%20vector(1)&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z"), { headers: requestHeaders });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "UNSUPPORTED_METRIC");
  assert.equal(queries.length, 0);
});

test("rejects invalid ranges and cluster IDs before an upstream call", async () => {
  queries = [];
  let response = await fetch(metricsUrl("names=gpu_utilization_pct&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z&step=1s"), { headers: requestHeaders });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_RANGE");

  response = await fetch(`${baseUrl}/api/v1/clusters/other-cluster/metrics?names=gpu_utilization_pct&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z`, { headers: requestHeaders });
  assert.equal(response.status, 404);
  assert.equal(queries.length, 0);
});

test("reports a disabled allowlisted metric as not configured", async () => {
  const disabledServer = createServer({
    config: loadConfig({ ...baseEnv, PROMETHEUS_TTFT_HISTOGRAM: "" }),
    fetchImpl: async () => { throw new Error("upstream must not be called"); },
    now: () => fixedNow,
  });
  await new Promise((resolve) => disabledServer.listen(0, "127.0.0.1", resolve));
  const disabledUrl = `http://127.0.0.1:${disabledServer.address().port}/api/v1/clusters/pilot-01/metrics?names=inference_ttft_seconds&start=2026-11-16T10:00:00Z&end=2026-11-16T11:00:00Z`;
  const response = await fetch(disabledUrl, { headers: requestHeaders });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "METRIC_NOT_CONFIGURED");
  await new Promise((resolve, reject) => disabledServer.close((error) => error ? reject(error) : resolve()));
});

test("translates upstream timeouts and failures to stable, non-leaking errors", async () => {
  fetchImpl = async () => {
    const error = new Error("private upstream detail");
    error.name = "TimeoutError";
    throw error;
  };
  server.close();
  server = createServer({ config: loadConfig(baseEnv), fetchImpl, now: () => fixedNow });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(metricsUrl(), { headers: requestHeaders });
  let body = await response.json();
  assert.equal(response.status, 504);
  assert.equal(body.error.code, "UPSTREAM_TIMEOUT");
  assert.equal(JSON.stringify(body).includes("private upstream detail"), false);

  fetchImpl = async () => new Response("private upstream detail", { status: 503 });
  server.close();
  server = createServer({ config: loadConfig(baseEnv), fetchImpl, now: () => fixedNow });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  response = await fetch(metricsUrl(), { headers: requestHeaders });
  body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.error.code, "UPSTREAM_UNAVAILABLE");
  assert.equal(JSON.stringify(body).includes("private upstream detail"), false);
});

test("supports GET only for data and reports liveness without exposing upstream configuration", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.status, "ok");
  assert.equal(JSON.stringify(body).includes("prometheus.internal"), false);

  const post = await fetch(metricsUrl(), { method: "POST", headers: requestHeaders });
  assert.equal(post.status, 405);
  assert.equal((await post.json()).error.code, "METHOD_NOT_ALLOWED");
});

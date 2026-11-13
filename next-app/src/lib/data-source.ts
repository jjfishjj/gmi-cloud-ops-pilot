import type { Metric } from "./mock-data";

/**
 * Future read-only BFF contract. The pilot API owner, auth/RBAC, source mappings,
 * and SLOs are not confirmed yet. Do not connect this interface to Prometheus
 * or customer infrastructure from the browser.
 */
export type ReadOnlyDashboardSnapshot = {
  asOf: string | null;
  freshnessSeconds: number | null;
  stale: boolean | null;
  gpuUtilization: Metric | null;
  inferenceOutputTokensPerSecond: Metric | null;
};

export const proposedReadOnlyEndpoints = {
  clusterSummary: "GET /api/v1/clusters/{clusterId}/summary?window={6h|24h|7d}",
  gpus: "GET /api/v1/clusters/{clusterId}/gpus",
  inferenceSummary: "GET /api/v1/deployments/{deploymentId}/inference/summary?window={6h|24h|7d}",
  alerts: "GET /api/v1/alerts?clusterId={clusterId}",
} as const;

// Intentionally no fetch implementation: this project has no pilot API or
// authorization contract. The UI currently uses only the explicit fixture.

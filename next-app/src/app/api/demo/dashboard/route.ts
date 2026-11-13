import { NextResponse } from "next/server";
import { dashboardFixture } from "@/lib/mock-data";

// Export a deterministic synthetic response for the static build; Pages strips it.
export const dynamic = "force-static";

/**
 * Public synthetic-demo route only. Do not replace the fixture with real
 * telemetry until server-side authentication and per-resource authorization
 * have been designed, implemented, and tested.
 *
 * Only GET is exported. Next.js returns 405 for unsupported methods.
 */
export async function GET() {
  return NextResponse.json(
    {
      data: dashboardFixture,
      meta: {
        mode: "simulated",
        telemetryConnected: false,
        asOf: null,
        freshnessSeconds: null,
        stale: null,
        message: "合成 fixture；未連接真實客戶、叢集、指標或告警來源。",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Data-Mode": "simulated",
      },
    },
  );
}

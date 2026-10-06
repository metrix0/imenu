import { startAnalysis } from "@/lib/ia-vendas/analysis";

export const runtime = "nodejs";
export const maxDuration = 300;

// Same Terra analyst, complete coverage, tools and report schema, without Batch.
// Requires the same server-side secret as the internal Batch entry point.
export async function POST(request: Request) { return startAnalysis(request, true); }

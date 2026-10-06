import { authorizeAnalysis, processAnalysisBatches } from "@/lib/ia-vendas/analysis";
import { failure } from "@/lib/ia-vendas/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    authorizeAnalysis(request, true);
    return Response.json({ processed: await processAnalysisBatches() });
  } catch (e) { return failure(e); }
}

import { startAnalysis } from "@/lib/ia-vendas/analysis";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) { return startAnalysis(request); }

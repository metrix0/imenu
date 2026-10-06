import type { Data } from "./types";
export function analysisPreview(analysis: Data): Data {
  const report = analysis.result?.report;
  if (!report) return { ...analysis, result: { reply: String(analysis.result?.reply || "").slice(0, 400) } };
  return { ...analysis, result: { report } };
}

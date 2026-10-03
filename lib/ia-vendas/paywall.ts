import type { Data } from "./types";
export function analysisPreview(analysis: Data): Data {
  const report = analysis.result?.report;
  if (!report) return { ...analysis, result: { reply: String(analysis.result?.reply || "").slice(0, 400) } };
  return { ...analysis, result: { report: {
    version: report.version, status: report.status, headline: report.headline, summary: report.summary,
    potential_estimate: report.potential_estimate,
    opportunity_count: report.opportunities?.length || 0,
    opportunities: (report.opportunities || []).slice(0, 1),
    review_items: report.opportunities?.length ? [] : (report.review_items || []).slice(0, 1),
  } } };
}

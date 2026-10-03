# IA Vendas analysis execution

Deep analysis defaults to OpenAI Batch using `IA_VENDAS_ANALYSIS_MODEL` (default `gpt-5.6-terra`). Normal chat stays synchronous. The customer chat endpoint continues to reject deep analysis; initiation is internal/manual.

## Start an analysis

`POST /api/ia-vendas/analysis`

Authorization: `Bearer <IA_VENDAS_ANALYSIS_SECRET>` (falls back to `CRON_SECRET`). The secret is server-only. Body:

```json
{
  "restaurant_id": "restaurant UUID",
  "run_id": "optional UUID used as an idempotency key",
  "text": "optional analysis instructions"
}
```

Returns HTTP 202 with `run_id`, `conversation_id`, `mode: "batch"`, `status: "queued"`. Repeating an existing run ID returns its status without creating another run. Reports and actions appear in the existing Análise workspace.

## Immediate test

`POST /api/ia-vendas/analysis/test`

Uses the same authorization/body, complete restaurant snapshot, Terra model, tool execution, strict report schema and persistence, with synchronous inference instead of Batch. Returns HTTP 200 on completion. This route does not apply proposals.

## Process queued results

`GET /api/cron/ia-vendas-analysis`, authorized with `Bearer <CRON_SECRET>`.

The production cron invokes it every 10 minutes. **Vercel cron does not run on localhost or preview**: invoke this protected endpoint periodically there, or use the immediate test route. Polling only resumes existing analyses; it does not schedule new analyses.

Each model round is a separate Batch request to `/v1/responses` with a 24-hour completion window. An analysis can take several rounds, so 24 hours is per round, not a promise for the entire report. Results are matched by `custom_id`. Tools run locally after a completed round, then their complete outputs go into the next Batch round. The last round forces synthesis. There is no automatic fallback to synchronous inference.

`ia_vendas_runs.result.batch` stores private snapshots, input, provider IDs, completed responses and tool results until synthesis. The customer API returns only Batch status/round. Cross-process locks prevent concurrent replay, stable action IDs prevent duplicate proposals, and model usage is recorded once per response. On completion, private processing checkpoints are removed; the structured report, coverage, selected evidence, action links, snapshots and token-cycle diagnostics remain. On provider failure or expiry without usable output, the partial report and prepared proposals remain available.

No schema changes or monthly analysis token quota were added. Chat can continue while a Batch analysis waits. Apply/reject/undo keep their existing behavior and conflict checks.

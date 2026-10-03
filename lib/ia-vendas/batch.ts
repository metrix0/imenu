import OpenAI, { toFile } from "openai";
import type { Response, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { createHash } from "crypto";
import { query } from "@/lib/database/sql";
import { SalesError, type Data } from "./types";

// One durable checkpoint per model round. Full context and tool outputs are retained
// until final synthesis; Batch never relies on a process or HTTP request staying alive.
export interface BatchSnapshot {
  ctx: Data;
  input: any[];
  cards: Data[];
  userMessageId: string;
  inputTokens: number;
  outputTokens: number;
  example: boolean;
  estimated: boolean;
  round: number;
}
export class BatchPending extends Error {}

export function actionId(run: string, call: string) {
  const bytes = createHash("sha256").update(`${run}:${call}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function readBatch(restaurant: string, run: string): Promise<Data> {
  return (await query(
    "SELECT result->'batch' batch FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND id=$2 AND status='running'",
    [restaurant, run],
  )).rows[0]?.batch || {};
}

async function patchBatch(restaurant: string, run: string, value: Data) {
  await query(
    "UPDATE public.ia_vendas_runs SET result=jsonb_set(coalesce(result,'{}'::jsonb),'{batch}',coalesce(result->'batch','{}'::jsonb)||$3::jsonb) WHERE restaurant_id=$1 AND id=$2 AND status='running'",
    [restaurant, run, JSON.stringify(value)],
  );
}

export async function saveToolResult(restaurant: string, run: string, call: string, value: Data) {
  await query(
    "UPDATE public.ia_vendas_runs SET result=jsonb_set(result,'{batch,tool_results}',coalesce(result->'batch'->'tool_results','{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)) WHERE restaurant_id=$1 AND id=$2 AND status='running'",
    [restaurant, run, call, JSON.stringify(value)],
  );
}

export function parseBatchOutput(content: string, customId: string): Response | null {
  for (const line of content.split("\n").filter((l) => l.trim())) {
    let row: Data;
    try { row = JSON.parse(line); }
    catch { throw new SalesError("O resultado da análise não pôde ser lido. As propostas prontas foram preservadas."); }
    if (row.custom_id !== customId) continue;
    if (row.error || row.response?.status_code !== 200)
      throw new SalesError("A análise não pôde ser concluída. As propostas prontas foram preservadas.");
    const response = row.response.body;
    // The SDK adds output_text on synchronous responses; JSONL contains the wire object.
    response.output_text = (response.output || [])
      .filter((o: Data) => o.type === "message")
      .flatMap((o: Data) => o.content)
      .filter((c: Data) => c.type === "output_text")
      .map((c: Data) => c.text).join("");
    return response;
  }
  return null;
}

export async function batchResponse(
  ai: OpenAI,
  restaurant: string,
  run: string,
  request: Data,
  checkpoint: BatchSnapshot,
): Promise<Response> {
  let state = await readBatch(restaurant, run);
  const round = checkpoint.round + 1;
  if (state.round !== round) {
    // JSON serialization freezes the input before response/tool mutations below.
    state = { ...state, checkpoint, request, round, id: null, input_file_id: null,
      response: null, tool_results: {}, submitting_at: null, status: "queued" };
    await patchBatch(restaurant, run, state);
  }
  if (state.response) return state.response;
  const customId = `${run}:${round}`;
  if (!state.input_file_id) {
    const file = await ai.files.create({ purpose: "batch", file: await toFile(
      Buffer.from(JSON.stringify({ custom_id: customId, method: "POST", url: "/v1/responses", body: state.request }) + "\n"),
      `analysis-${run}-${round}.jsonl`,
    ) });
    state.input_file_id = file.id;
    await patchBatch(restaurant, run, { input_file_id: file.id });
  }
  if (!state.id) {
    if (state.submitting_at) {
      // Recover a create that succeeded before its ID could be checkpointed.
      // This also protects against providers ignoring an idempotency header.
      for await (const existing of ai.batches.list({ limit: 100 })) {
        if (existing.metadata?.analysis_run === run && existing.metadata?.round === String(round) &&
            existing.input_file_id === state.input_file_id) {
          await patchBatch(restaurant, run, { id: existing.id, status: existing.status });
          throw new BatchPending();
        }
        if (existing.created_at * 1000 < Date.parse(state.submitting_at) - 60000) break;
      }
    } else {
      await patchBatch(restaurant, run, { submitting_at: new Date().toISOString() });
    }
    const batch = await ai.batches.create({
      input_file_id: state.input_file_id,
      endpoint: "/v1/responses",
      completion_window: "24h",
      metadata: { analysis_run: run, round: String(round) },
    }, { idempotencyKey: `iavendas-analysis-${run}-${round}` });
    await patchBatch(restaurant, run, { id: batch.id, status: batch.status });
    throw new BatchPending();
  }
  const batch = await ai.batches.retrieve(state.id);
  await patchBatch(restaurant, run, { status: batch.status });
  if (!["completed", "failed", "expired", "cancelled"].includes(batch.status))
    throw new BatchPending();
  // Expired/cancelled jobs can still contain a completed request. Consume it first.
  if (batch.output_file_id) {
    const content = await (await ai.files.content(batch.output_file_id)).text();
    const response = parseBatchOutput(content, customId);
    if (response) {
      await patchBatch(restaurant, run, { response });
      return response;
    }
  }
  throw new SalesError("A análise em lote foi interrompida. As propostas prontas foram preservadas no relatório parcial.");
}

// Ensures the same request body is valid for both transports at compile time.
export type AnalysisRequest = ResponseCreateParamsNonStreaming;

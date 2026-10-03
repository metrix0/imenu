import { randomUUID, timingSafeEqual } from "crypto";
import { query, withTransaction } from "@/lib/database/sql";
import { runChat } from "./chat";
import { finishRun } from "./runs";
import { isUuid } from "./catalog";
import { failure } from "./http";
import { SalesError } from "./types";

export function authorizeAnalysis(request: Request, cron = false) {
  const secret = (cron ? process.env.CRON_SECRET : process.env.IA_VENDAS_ANALYSIS_SECRET || process.env.CRON_SECRET)?.trim();
  const provided = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!expected || Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected)))
    throw new SalesError("Não autorizado.", 401);
}

export async function analysisConversation(restaurant: string) {
  if (!(await query("SELECT id FROM public.restaurants WHERE id=$1", [restaurant])).rowCount)
    throw new SalesError("Restaurante não encontrado.", 404);
  return (await query(
    "INSERT INTO public.ia_vendas_conversations (restaurant_id,kind,title) VALUES ($1,'analysis','Análise') ON CONFLICT(restaurant_id) WHERE kind='analysis' DO UPDATE SET archived=false RETURNING id",
    [restaurant],
  )).rows[0].id as string;
}

export async function processAnalysisBatches() {
  const jobs = (await query(
    "SELECT id,restaurant_id FROM public.ia_vendas_runs WHERE status='running' AND kind='analysis' AND result->'batch'->>'mode'='batch' ORDER BY coalesce(result->'batch'->>'polled_at',created_at::text) LIMIT 3",
  )).rows;
  const processed: string[] = [];
  const deadline = Date.now() + 180000;
  for (const job of jobs) {
    if (Date.now() >= deadline) break;
    // Cross-process lock protects checkpoint replay and final report persistence.
    // No run row is locked while tools use their own transactions.
    await withTransaction(async (c) => {
      const locked = (await c.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,9)) locked", [job.id])).rows[0].locked;
      if (!locked) return;
      const current = (await query(
        "SELECT result,created_at FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND id=$2 AND status='running'",
        [job.restaurant_id, job.id],
      )).rows[0];
      if (!current) return;
      const batch = current.result.batch;
      if (!batch.checkpoint) {
        if (Date.now() - Date.parse(current.created_at) > 360000)
          await finishRun(job.restaurant_id, job.id, { report: current.result.report || null }, "A preparação da análise foi interrompida. Inicie uma nova análise.");
        return;
      }
      await query(
        "UPDATE public.ia_vendas_runs SET result=jsonb_set(result,'{batch,polled_at}',to_jsonb(now())) WHERE restaurant_id=$1 AND id=$2 AND status='running'",
        [job.restaurant_id, job.id],
      );
      await runChat({ ...batch.args, resume: batch.checkpoint, batchLocked: true, send: () => {} });
      processed.push(job.id);
    });
  }
  return processed;
}

// Internal/manual entry point. Analysis uses Batch unless explicitly invoked by
// the separate immediate test route; the customer chat route remains unchanged.
export async function startAnalysis(request: Request, immediate = false) {
  try {
    authorizeAnalysis(request);
    const body = await request.json();
    if (!isUuid(body.restaurant_id) || (body.run_id != null && !isUuid(body.run_id)) ||
        (body.text != null && (typeof body.text !== "string" || !body.text.trim() || body.text.length > 8000)))
      throw new SalesError("Análise inválida.");
    const conversation = await analysisConversation(body.restaurant_id);
    const run = body.run_id || randomUUID();
    let error: string | undefined;
    let duplicateStatus: string | undefined;
    await runChat({ restaurant: body.restaurant_id, conversation, run,
      text: body.text?.trim() || "Analise meu restaurante e priorize as melhorias com maior impacto.",
      attachments: [], deep: true, immediate,
      send: (event, data) => {
        if (event === "error") error = data.message;
        if (data.duplicate) duplicateStatus = data.status;
      },
    });
    return Response.json({ run_id: run, conversation_id: conversation,
      mode: immediate ? "immediate" : "batch",
      status: error ? "failed" : duplicateStatus || (immediate ? "completed" : "queued"),
      ...(error ? { error } : {}),
    }, { status: error ? 500 : immediate || duplicateStatus ? 200 : 202 });
  } catch (e) { return failure(e); }
}

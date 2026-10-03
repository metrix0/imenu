import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import { LIMITS, MODELS } from "./config";
import { SalesError } from "./types";
export async function beginRun(
  restaurant: string,
  conversation: string,
  id: string,
  kind: "chat" | "analysis" | "image",
  initialResult?: Record<string, unknown>,
) {
  return withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
      restaurant,
    ]);
    const old = (
      await c.query(
        "SELECT id,status,result FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND id=$2",
        [restaurant, id],
      )
    ).rows[0];
    if (old) return old;
    await c.query(
      "UPDATE public.ia_vendas_runs SET status='failed',error='Processamento interrompido.',finished_at=now() WHERE restaurant_id=$1 AND status='running' AND created_at<now()-interval '6 minutes' AND coalesce(result->'batch'->>'mode','')<>'batch'",
      [restaurant],
    );
    if (
      (
        await c.query(
          "SELECT 1 FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND status='running' AND ($2='analysis' OR coalesce(result->'batch'->>'mode','')<>'batch')",
          [restaurant, kind],
        )
      ).rowCount
    )
      throw new SalesError("Aguarde a resposta em andamento.", 409);
    const usage = (
      await c.query(
        "SELECT coalesce(sum(greatest(input_tokens,reserved_input)) FILTER (WHERE kind=$2),0)::float input,coalesce(sum(greatest(output_tokens,reserved_output)) FILTER (WHERE kind=$2),0)::float output,count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int recent FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND created_at>=date_trunc('month',now())",
        [restaurant, kind],
      )
    ).rows[0];
    const output =
      kind === "analysis" ? LIMITS.analysisOutput : LIMITS.chatOutput;
    if (
      kind !== "analysis" &&
      (usage.recent >= 5 ||
        usage.input + (kind === "image" ? 0 : LIMITS.runInput) > 1500000 ||
        usage.output + (kind === "image" ? 0 : output) > 120000)
    )
      throw new SalesError(
        "A IA atingiu a capacidade disponível. Tente novamente mais tarde.",
        429,
      );
    await c.query(
      "INSERT INTO public.ia_vendas_runs (id,restaurant_id,conversation_id,kind,model,reserved_input,reserved_output,result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
      [
        id,
        restaurant,
        conversation,
        kind,
        kind === "image" ? MODELS.image : MODELS[kind],
        kind === "image"
          ? 0
          : kind === "analysis"
            ? LIMITS.analysisInput
            : LIMITS.runInput,
        kind === "image" ? 0 : output,
        initialResult ? JSON.stringify(initialResult) : null,
      ],
    );
    return null;
  });
}
export async function recordTokens(
  restaurant: string,
  id: string,
  input: number,
  output: number,
  cycle?: Record<string, unknown>,
) {
  await query(
    "UPDATE public.ia_vendas_runs SET input_tokens=input_tokens+$3,output_tokens=output_tokens+$4,result=CASE WHEN $5::jsonb IS NULL THEN result ELSE coalesce(result,'{}'::jsonb)||jsonb_build_object('cycles',coalesce(result->'cycles','[]'::jsonb)||$5::jsonb) END WHERE restaurant_id=$1 AND id=$2 AND status='running' AND ($6::text IS NULL OR NOT coalesce(result->'cycles','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('response_id',$6::text)))",
    [restaurant, id, input, output, cycle ? JSON.stringify([cycle]) : null, cycle?.response_id || null],
  );
}
export async function reserveImage(restaurant: string, run: string) {
  await withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
      restaurant,
    ]);
    const n = Number(
      (
        await c.query(
          "SELECT coalesce(sum(image_count),0) n FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND created_at>=date_trunc('month',now())",
          [restaurant],
        )
      ).rows[0].n,
    );
    if (n >= LIMITS.images)
      throw new SalesError(
        "A geração de imagens atingiu a capacidade disponível.",
        429,
      );
    if (
      !(
        await c.query(
          "UPDATE public.ia_vendas_runs SET image_count=image_count+1 WHERE id=$1 AND restaurant_id=$2 AND status='running'",
          [run, restaurant],
        )
      ).rowCount
    )
      throw new SalesError("Geração expirada.", 409);
  });
}
export async function finishRun(
  restaurant: string,
  id: string,
  result: any,
  error?: string,
  client?: PoolClient,
) {
  const execute = client
    ? (sql: string, params: any[]) => client.query(sql, params)
    : query;
  await execute(
    "UPDATE public.ia_vendas_runs SET status=$3,result=(coalesce(result,'{}'::jsonb)-'batch')||coalesce($4::jsonb,'{}'::jsonb)||CASE WHEN result->'batch'->>'mode'='batch' THEN jsonb_build_object('batch',jsonb_build_object('mode','batch','id',result->'batch'->>'id','round',result->'batch'->'round','status',$3)) ELSE '{}'::jsonb END,error=$5,finished_at=now(),reserved_input=CASE WHEN $3='completed' THEN 0 ELSE reserved_input END,reserved_output=CASE WHEN $3='completed' THEN 0 ELSE reserved_output END WHERE restaurant_id=$1 AND id=$2 AND status='running'",
    [
      restaurant,
      id,
      error ? "failed" : "completed",
      JSON.stringify(result),
      error || null,
    ],
  );
}

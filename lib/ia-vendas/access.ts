import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { SalesError } from "./types";

export const FREE_AI_TOKENS = 150_000;
export const FREE_AI_IMAGES = 1;
export const FREE_AI_MESSAGE_TOKENS = 60_000;
export class IaPlusRequired extends SalesError {
  code = "IA_PLUS_REQUIRED";
  constructor(message = "Continue com o iMenu IA Plus para usar esta função.") { super(message, 402); }
}
export class IaImageLimitReached extends SalesError {
  constructor() {
    super("Seu limite semanal de geração de imagens foi atingido. Para gerar mais imagens, assine o iMenu IA Plus. Você ainda pode conversar e realizar outras tarefas pelo Assistente IA.");
  }
}
export async function aiAccess(restaurant: string, client?: Pick<PoolClient, "query">) {
  const execute = (sql: string, params: any[]) => client ? client.query(sql, params) : query(sql, params);
  const addon = (await execute("SELECT status,current_period_ends_at FROM public.restaurant_addons WHERE restaurant_id=$1 AND product_key='ia_plus'", [restaurant])).rows[0] || null;
  const plus = hasQrTableAccess(addon);
  const usage = (await execute(`SELECT
    coalesce(sum(input_tokens + output_tokens) FILTER (WHERE kind='chat' AND status='completed' AND coalesce(result->>'quota_exempt','false')<>'true' AND created_at>=now()-interval '7 days'),0)::int tokens,
    coalesce(sum(reserved_input + reserved_output) FILTER (WHERE kind='chat' AND status='running' AND created_at>now()-interval '6 minutes'),0)::int reserved,
    coalesce(sum(image_count) FILTER (WHERE created_at>=now()-interval '7 days'),0)::int images
    FROM public.ia_vendas_runs WHERE restaurant_id=$1`, [restaurant])).rows[0];
  return { plus, reserved_tokens: Number(usage?.reserved || 0), tokens_remaining: plus ? null : Math.max(0, FREE_AI_TOKENS - Number(usage?.tokens || 0)), images_remaining: plus ? null : Math.max(0, FREE_AI_IMAGES - Number(usage?.images || 0)) };
}
export async function requireIaPlus(restaurant: string) {
  if (!(await aiAccess(restaurant)).plus) throw new IaPlusRequired();
}

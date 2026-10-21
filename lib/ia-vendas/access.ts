import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { SalesError } from "./types";
import { LIMITS } from "./config";

export const FREE_AI_TOKENS = 150_000;
export const FREE_AI_IMAGES = 3;
export const FREE_AI_MESSAGE_TOKENS = 60_000;
export class IaPlusRequired extends SalesError {
  code = "IA_PLUS_REQUIRED";
  constructor(message = "Continue com o iMenu IA Plus para usar esta função.") { super(message, 402); }
}
export class IaImageLimitReached extends SalesError {
  constructor(plus = false) {
    super(plus
      ? "Seu limite mensal de 50 imagens do iMenu IA Plus foi atingido. Novas gerações estarão disponíveis no próximo mês."
      : "Seu limite semanal de geração de imagens foi atingido. Para gerar mais imagens, assine o iMenu IA Plus. Você ainda pode conversar e realizar outras tarefas pelo Assistente IA.");
  }
}
export async function aiAccess(restaurant: string, client?: Pick<PoolClient, "query">) {
  const execute = (sql: string, params: any[]) => client ? client.query(sql, params) : query(sql, params);
  const addon = (await execute("SELECT status,current_period_ends_at FROM public.restaurant_addons WHERE restaurant_id=$1 AND product_key='ia_plus'", [restaurant])).rows[0] || null;
  const plus = hasQrTableAccess(addon);
  const usedApplication = (await execute(`SELECT EXISTS(
    SELECT 1 FROM public.ia_vendas_actions a
    JOIN public.ia_vendas_conversations c ON c.id=a.conversation_id AND c.restaurant_id=a.restaurant_id
    WHERE a.restaurant_id=$1 AND c.kind='chat' AND a.applied_at IS NOT NULL AND a.image_jobs IS NULL
  ) used`, [restaurant])).rows[0]?.used === true;
  const usage = (await execute(`SELECT
    coalesce(sum(input_tokens + output_tokens) FILTER (WHERE kind='chat' AND status='completed' AND coalesce(result->>'quota_exempt','false')<>'true' AND created_at>=now()-interval '7 days'),0)::int tokens,
    coalesce(sum(reserved_input + reserved_output) FILTER (WHERE kind='chat' AND status='running' AND created_at>now()-interval '6 minutes'),0)::int reserved,
    coalesce(sum(image_count) FILTER (WHERE created_at>=now()-interval '7 days'),0)::int images,
    coalesce(sum(image_count) FILTER (WHERE created_at>=date_trunc('month',now())),0)::int monthly_images
    FROM public.ia_vendas_runs WHERE restaurant_id=$1`, [restaurant])).rows[0];
  return { plus, free_applications_remaining: plus ? null : usedApplication ? 0 : 1, reserved_tokens: Number(usage?.reserved || 0), tokens_remaining: plus ? null : Math.max(0, FREE_AI_TOKENS - Number(usage?.tokens || 0)), images_remaining: plus ? Math.max(0, LIMITS.images - Number(usage?.monthly_images || 0)) : Math.max(0, FREE_AI_IMAGES - Number(usage?.images || 0)) };
}
export async function requireApplicationAccess(restaurant: string, conversation: string, client?: Pick<PoolClient, "query">) {
  const execute = (sql: string, params: any[]) => client ? client.query(sql, params) : query(sql, params);
  const access = await aiAccess(restaurant, client);
  if (access.plus) return;
  const kind = (await execute("SELECT kind FROM public.ia_vendas_conversations WHERE restaurant_id=$1 AND id=$2", [restaurant, conversation])).rows[0]?.kind;
  if (kind !== "chat") throw new IaPlusRequired();
  if (access.free_applications_remaining !== 1)
    throw new IaPlusRequired("Sua primeira aplicação grátis já foi usada. Assine o iMenu IA Plus para aplicar mais melhorias.");
}
export async function requireIaPlus(restaurant: string) {
  if (!(await aiAccess(restaurant)).plus) throw new IaPlusRequired();
}

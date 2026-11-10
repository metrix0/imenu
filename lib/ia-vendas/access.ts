import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { SalesError } from "./types";
import { LIMITS } from "./config";
import { formatAiResetAt } from "./usageReset";

export const FREE_AI_TOKENS = 150_000;
export const FREE_AI_IMAGES = 3;
export const FREE_AI_MESSAGE_TOKENS = 60_000;
export class IaPlusRequired extends SalesError {
  code = "IA_PLUS_REQUIRED";
  constructor(message = "Continue com o iMenu Plus para usar esta função.") { super(message, 402); }
}
export function imageLimitMessage(access: { plus: boolean; images_reset_at?: string | null }) {
  if (!access.plus)
    return `Seu limite gratuito de imagens foi atingido. Adquira iMenu Plus para continuar gerando imagens, com até ${LIMITS.images} imagens por mês.`;
  const reset = formatAiResetAt(access.images_reset_at);
  return `Seu limite mensal de ${LIMITS.images} imagens do iMenu Plus foi atingido. ${reset
    ? `Novas imagens disponíveis em ${reset}.`
    : "Novas imagens estarão disponíveis quando o limite for renovado."} Você pode continuar conversando e usando as outras funções do Assistente IA normalmente. Para ajuda, fale com o suporte pelo WhatsApp: +55 19 99723-5394.`;
}
export class IaImageLimitReached extends SalesError {
  constructor(plus = false, resetAt: string | null = null) {
    super(imageLimitMessage({ plus, images_reset_at: resetAt }));
  }
}

/** Persist a regular assistant message with the existing purchase and support actions. */
export async function saveImageLimitNotice(restaurant: string, conversation: string) {
  const access = await aiAccess(restaurant);
  if (Number(access.images_remaining) > 0) return false;
  await query(
    "INSERT INTO public.ia_vendas_messages (restaurant_id,conversation_id,role,content,cards) VALUES ($1,$2,'assistant',$3,$4::jsonb)",
    [restaurant, conversation, imageLimitMessage(access), JSON.stringify([{ type: "image_limit" }])],
  );
  await query(
    "UPDATE public.ia_vendas_conversations SET updated_at=now() WHERE restaurant_id=$1 AND id=$2",
    [restaurant, conversation],
  );
  return true;
}
export async function aiAccess(restaurant: string, client?: Pick<PoolClient, "query">) {
  const execute = (sql: string, params: any[]) => client ? client.query(sql, params) : query(sql, params);
  const plus = await hasIMenuPlusAccess(restaurant, client);
  const usedApplication = (await execute(`SELECT EXISTS(
    SELECT 1 FROM public.ia_vendas_actions a
    JOIN public.ia_vendas_conversations c ON c.id=a.conversation_id AND c.restaurant_id=a.restaurant_id
    WHERE a.restaurant_id=$1 AND c.kind='chat' AND a.applied_at IS NOT NULL AND a.image_jobs IS NULL
  ) used`, [restaurant])).rows[0]?.used === true;
  const usage = (await execute(`SELECT
    coalesce(sum(input_tokens + output_tokens) FILTER (WHERE kind='chat' AND status='completed' AND coalesce(result->>'quota_exempt','false')<>'true' AND created_at>=now()-interval '7 days'),0)::int tokens,
    coalesce(sum(reserved_input + reserved_output) FILTER (WHERE kind='chat' AND status='running' AND created_at>now()-interval '6 minutes'),0)::int reserved,
    coalesce(sum(image_count) FILTER (WHERE created_at>=now()-interval '7 days'),0)::int images,
    coalesce(sum(image_count) FILTER (WHERE created_at>=date_trunc('month',now())),0)::int monthly_images,
    coalesce(sum(greatest(input_tokens,reserved_input)) FILTER (WHERE kind='chat' AND created_at>=date_trunc('month',now())),0)::float monthly_input,
    coalesce(sum(greatest(output_tokens,reserved_output)) FILTER (WHERE kind='chat' AND created_at>=date_trunc('month',now())),0)::float monthly_output,
    (date_trunc('month', now()) + interval '1 month') monthly_reset_at
    FROM public.ia_vendas_runs WHERE restaurant_id=$1`, [restaurant])).rows[0];
  const wallet = (await execute(
    "SELECT input_tokens,output_tokens,images FROM public.ia_vendas_credit_balances WHERE restaurant_id=$1",
    [restaurant],
  )).rows[0];
  const purchased = {
    input: Number(wallet?.input_tokens || 0),
    output: Number(wallet?.output_tokens || 0),
    images: Number(wallet?.images || 0),
  };
  const input = Number(usage?.monthly_input || 0), output = Number(usage?.monthly_output || 0);
  const monthlyUsage = plus ? {
    tokens: { input, output, input_limit: LIMITS.monthlyChatInput, output_limit: LIMITS.monthlyChatOutput,
      percent: Math.max(input / LIMITS.monthlyChatInput, output / LIMITS.monthlyChatOutput) * 100 },
    images: { used: Number(usage?.monthly_images || 0), limit: LIMITS.images, percent: Number(usage?.monthly_images || 0) / LIMITS.images * 100 },
  } : null;
  const freeTokensUsed = Number(usage?.tokens || 0);
  const freeImagesUsed = Number(usage?.images || 0);
  let freeTokensResetAt: string | null = null;
  let freeImagesResetAt: string | null = null;
  if (!plus && (freeTokensUsed >= FREE_AI_TOKENS || freeImagesUsed >= FREE_AI_IMAGES)) {
    const reset = (await execute(`
      WITH counted AS (
        SELECT id, created_at,
          CASE WHEN kind='chat' AND status='completed' AND coalesce(result->>'quota_exempt','false')<>'true'
            THEN input_tokens + output_tokens ELSE 0 END AS tokens,
          image_count AS images
        FROM public.ia_vendas_runs
        WHERE restaurant_id=$1 AND created_at>=now()-interval '7 days'
      ), expired AS (
        SELECT created_at + interval '7 days' AS expires_at,
          sum(tokens) OVER (ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS tokens_expired,
          sum(images) OVER (ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS images_expired
        FROM counted
      )
      SELECT min(expires_at) FILTER (WHERE tokens_expired > $2) AS tokens_reset_at,
             min(expires_at) FILTER (WHERE images_expired > $3) AS images_reset_at
      FROM expired
    `, [restaurant, Math.max(0, freeTokensUsed - FREE_AI_TOKENS), Math.max(0, freeImagesUsed - FREE_AI_IMAGES)])).rows[0];
    if (freeTokensUsed >= FREE_AI_TOKENS && reset?.tokens_reset_at)
      freeTokensResetAt = new Date(reset.tokens_reset_at).toISOString();
    if (freeImagesUsed >= FREE_AI_IMAGES && reset?.images_reset_at)
      freeImagesResetAt = new Date(reset.images_reset_at).toISOString();
  }
  const monthlyResetAt = usage?.monthly_reset_at
    ? new Date(usage.monthly_reset_at).toISOString()
    : null;
  return {
    plus, usage: monthlyUsage,
    free_applications_remaining: plus ? null : usedApplication ? 0 : 1,
    reserved_tokens: Number(usage?.reserved || 0),
    tokens_remaining: plus ? null : Math.max(0, FREE_AI_TOKENS - freeTokensUsed) +
      Math.max(0, Math.min(purchased.input, purchased.output)),
    images_remaining: Math.max(0,
      plus ? LIMITS.images - Number(usage?.monthly_images || 0) : FREE_AI_IMAGES - freeImagesUsed)
      + Math.max(0, purchased.images),
    purchased_credits: purchased,
    base_tokens_remaining: plus ? null : Math.max(0, FREE_AI_TOKENS - freeTokensUsed),
    base_images_remaining: Math.max(0, plus ? LIMITS.images - Number(usage?.monthly_images || 0) : FREE_AI_IMAGES - freeImagesUsed),
    free_tokens_limit: plus ? null : FREE_AI_TOKENS,
    free_images_limit: plus ? null : FREE_AI_IMAGES,
    tokens_reset_at: plus ? monthlyResetAt : freeTokensResetAt,
    images_reset_at: plus ? monthlyResetAt : freeImagesResetAt,
  };
}
export async function requireApplicationAccess(restaurant: string, conversation: string, client?: Pick<PoolClient, "query">) {
  const execute = (sql: string, params: any[]) => client ? client.query(sql, params) : query(sql, params);
  const access = await aiAccess(restaurant, client);
  if (access.plus) return;
  const kind = (await execute("SELECT kind FROM public.ia_vendas_conversations WHERE restaurant_id=$1 AND id=$2", [restaurant, conversation])).rows[0]?.kind;
  if (kind !== "chat") throw new IaPlusRequired();
  if (access.free_applications_remaining !== 1)
    throw new IaPlusRequired("Sua primeira aplicação grátis já foi usada. Assine o iMenu Plus para aplicar mais melhorias.");
}
export async function requireIaPlus(restaurant: string) {
  if (!(await aiAccess(restaurant)).plus) throw new IaPlusRequired();
}


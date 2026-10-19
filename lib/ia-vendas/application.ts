import { query } from "@/lib/database/sql";
import { apply } from "./actions";
import { aiAccess, FREE_AI_IMAGES, requireApplicationAccess } from "./access";
import { applyImages, publishImage } from "./images";
import { SalesError, type Action } from "./types";

// Shared by the reviewed button and approval inside Assistente IA.
export async function applyProposal(restaurant: string, id: string, conversation?: string, intent?: "publish" | "generate", existingRun?: string) {
  const action = (await query<Action>(
    "SELECT * FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND (r.result->>'detached_at' IS NOT NULL OR (r.kind='analysis' AND (r.status<>'completed' OR r.result->'report'->>'status' IS DISTINCT FROM 'complete'))))",
    [restaurant, id],
  )).rows[0];
  if (!action || (conversation && action.conversation_id !== conversation))
    throw new SalesError("Proposta não encontrada.", 404);
  if ((intent === "publish" && !action.image) || (intent === "generate" && !action.image_jobs))
    throw new SalesError(intent === "publish" ? "Aprove a publicação no cartão da prévia escolhida." : "Esta proposta não é de geração de imagens.");
  if (action.status === "applied") return action;
  if ((action.image_jobs?.length || 0) > FREE_AI_IMAGES && !(await aiAccess(restaurant)).plus)
    throw new SalesError("No acesso gratuito, gere apenas uma imagem por lote.");
  await requireApplicationAccess(restaurant, action.conversation_id);
  if (action.image_jobs) return { ...action, ...await applyImages(restaurant, id, existingRun) };
  if (!["pending", "failed", "applying"].includes(action.status) || action.attempts >= 2)
    throw new SalesError("Peça uma proposta atualizada.", 409);
  if (action.image) await publishImage(restaurant, action);
  return apply(restaurant, id);
}

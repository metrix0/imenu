import { query } from "@/lib/database/sql";
import type { Data } from "./types";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Permission comes from the owner's original message, never a model-provided flag.
export function explicitlyTargetsImage(message: string, name: string, target: string) {
  const text = normalize(message), label = normalize(name);
  if (/\b(todos|todas|all|restantes|nao|nunca|never|dont|not|don t)\b/.test(text)) return false;
  if (!/\b(imagem|imagens|foto|fotos|image|photo|refaca|refazer|regenere|regenerar|regenerate|melhore|melhorar|arruma|arrumar|altere|alterar|mude|mudar|troque|trocar|igual|fundo|escrito|nova|novo|redo|replace|change|improve)\b/.test(text)) return false;
  if (target !== "item") return new RegExp(`\\b${target === "logo" ? "logo|logotipo" : "banner"}\\b`).test(text);
  if (label && (` ${text} `).includes(` ${label} `)) return true;
  const numbered = /^(?:n[oº°]?|numero)\s*(\d+)\b/i.exec(name);
  return !!numbered && new RegExp(`(?:n[oº°]?|numero)\\s*0*${Number(numbered[1])}\\b`, "i").test(text);
}

export async function imageAllowed(restaurant: string, sourceRun: string, input: Data, name: string) {
  const entity = input.target === "item" ? "items" : "restaurants";
  const field = input.target === "item" ? "image_path" : input.target === "logo" ? "logo_url" : "banner_url";
  const applied = (await query(`SELECT 1 FROM public.ia_vendas_actions a
    WHERE a.restaurant_id=$1 AND a.status='applied' AND a.image IS NOT NULL
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.operations) op
      WHERE op->>'entity'=$2 AND op->>'id'=$3 AND op->'values' ? $4) LIMIT 1`,
    [restaurant, entity, input.target === "item" ? input.item_id : restaurant, field])).rows.length > 0;
  if (!applied) return true;
  const message = (await query(`SELECT m.content FROM public.ia_vendas_runs r
    JOIN public.ia_vendas_messages m ON m.restaurant_id=r.restaurant_id AND m.conversation_id=r.conversation_id
    WHERE r.restaurant_id=$1 AND r.id=$2 AND m.role='user'
    AND (m.id::text=r.result->>'user_message_id' OR (r.result->>'user_message_id' IS NULL AND m.created_at>=r.created_at))
    ORDER BY m.created_at LIMIT 1`, [restaurant, sourceRun])).rows[0]?.content;
  return typeof message === "string" && explicitlyTargetsImage(message, name, input.target);
}

export async function approvedImageStyles(restaurant: string): Promise<Data[]> {
  return (await query(`SELECT DISTINCT ON (image->>'profile',operations->0->>'id')
    image->>'profile' profile,operations->0->>'id' target_id,image->'style' style,applied_at
    FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND status='applied'
    AND image->'style' IS NOT NULL
    ORDER BY image->>'profile',operations->0->>'id',applied_at DESC LIMIT 100`, [restaurant])).rows;
}

export function resolveImageStyle(approved: Data[], input: Data, targetId: string): Data {
  const relevant = approved.filter(row => row.profile === input.target)
    .sort((a,b) => Date.parse(b.applied_at) - Date.parse(a.applied_at));
  const sameProduct = relevant.find(row => row.target_id === targetId)?.style || {};
  const latest = relevant[0]?.style || {};
  const supplied = input.style && typeof input.style === "object" ? input.style : {};
  const style: Data = {};
  for (const key of ["background", "text", "ingredients", "presentation"]) {
    const value = supplied[key] ?? sameProduct[key] ?? (["background", "text"].includes(key) ? latest[key] : undefined);
    if (typeof value === "string") style[key] = value.slice(0, 1500);
  }
  return style;
}

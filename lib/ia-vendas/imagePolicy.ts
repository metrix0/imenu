import { query } from "@/lib/database/sql";
import type { Data } from "./types";

// Do not create required style slots. Keep only what the owner explicitly requests.
export function requestedImageStyle(message: string): Data {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const style: Data = {};
  const background = normalized.match(/\bfundo\s+(claro|branco|escuro|preto|bege|neutro)\b/);
  if (background) style.background = "fundo " + background[1];
  else if (/\bmesa de restaurante\b/.test(normalized)) style.background = "mesa de restaurante";
  if (/\bsem\s+(?:texto|letras|escrita)\b/.test(normalized)) style.text = "";
  else {
    const lettering = message.match(/\btexto\s*(?::|=)\s*["“]([^"”]{1,120})["”]/i);
    if (lettering) style.text = lettering[1];
  }
  if (/\b(?:45\s*(?:°|graus)|angulo de 45)\b/.test(normalized))
    style.presentation = "ângulo de 45 graus";
  else if (/\b(?:de cima|vista superior)\b/.test(normalized))
    style.presentation = "vista de cima";
  return style;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Permission comes from the owner's original message, never a model-provided flag.
export function explicitlyTargetsImage(message: string, name: string, target: string) {
  // Publication approval is separate from permission to generate a preview.
  const text = normalize(message)
    .replace(/\b(?:nao|nunca)\s+(?:publique|publicar|publica)(?:\s+automaticamente)?\b[^;.!?]*/g, "")
    .replace(/\b(?:do not|don t|dont|never)\s+publish(?:\s+automatically)?\b[^;.!?]*/g, "");
  const label = normalize(name);
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
  const rows = (await query(`SELECT
    a.image->>'profile' profile, a.operations->0->>'id' target_id,
    a.image->'explicit_style' explicit_style, a.applied_at,
    (SELECT m.content FROM public.ia_vendas_runs r
      JOIN public.ia_vendas_messages m ON m.restaurant_id=r.restaurant_id
        AND m.conversation_id=r.conversation_id AND m.role='user'
        AND m.id::text=r.result->>'user_message_id'
      WHERE r.restaurant_id=a.restaurant_id AND r.id=a.run_id LIMIT 1) owner_message
    FROM public.ia_vendas_actions a WHERE a.restaurant_id=$1 AND a.status='applied'
    AND (a.image->'explicit_style' IS NOT NULL OR a.image->'style' IS NOT NULL)
    ORDER BY a.applied_at DESC LIMIT 100`, [restaurant])).rows;
  // A previously published image is not itself permission to reuse model-invented styles.
  return rows.map(row => {
    const source = row.explicit_style && typeof row.explicit_style === "object"
      ? row.explicit_style : requestedImageStyle(String(row.owner_message || ""));
    const style: Data = {};
    for (const key of ["background", "text", "ingredients", "presentation"])
      if (typeof source[key] === "string") style[key] = source[key].slice(0, 1500);
    return { profile: row.profile, target_id: row.target_id, applied_at: row.applied_at, style };
  }).filter(row => Object.keys(row.style).length > 0);
}

export function resolveImageStyle(approved: Data[], input: Data, targetId: string): Data {
  const relevant = approved.filter(row => row.profile === input.target)
    .sort((a,b) => Date.parse(b.applied_at) - Date.parse(a.applied_at));
  const supplied = input.style && typeof input.style === "object" ? input.style : {};
  const style: Data = {};
  for (const key of ["background", "text", "ingredients", "presentation"]) {
    const own = relevant.find(row => row.target_id === targetId
      && typeof row.style?.[key] === "string")?.style[key];
    const shared = ["background", "text", "presentation"].includes(key)
      ? relevant.find(row => typeof row.style?.[key] === "string"
          && (key !== "presentation" ||
            ["ângulo de 45 graus", "vista de cima"].includes(row.style[key])))?.style[key]
      : undefined;
    const value = supplied[key] ?? own ?? shared;
    if (typeof value === "string") style[key] = value.slice(0, 1500);
  }
  return style;
}

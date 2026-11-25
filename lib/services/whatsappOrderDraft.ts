import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Coordinates } from "@/lib/api/geocodingBase";
import { query } from "@/lib/database/sql";

export type DraftLine = {
    id: string;
    itemIds: string[];
    quantity: number;
    options: { id: string; quantity: number }[];
    observation: string;
};

export type DraftAddress = {
    cep: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    complemento: string;
    referencia: string;
};

export type WhatsAppOrderDraft = {
    revision: string;
    expiresAt: number;
    items: DraftLine[];
    name?: string;
    destination?: "entrega" | "retirada";
    address?: DraftAddress;
    schedule?: string | null;
    payment?: string;
    quote?: { code: string; hash: string };
    receipt?: { code: string; orderId: string };
};

export type WhatsAppOrderChat = { restaurantId: string; chatId: string };
const DRAFT_TTL = 30 * 60_000;

export class WhatsAppOrderError extends Error {}

export async function readWhatsAppOrderDraft({ restaurantId, chatId }: WhatsAppOrderChat) {
    const { rows } = await query<{ order_draft: WhatsAppOrderDraft | null }>(
        "SELECT order_draft FROM whatsapp_conversations WHERE restaurant_id=$1 AND chat_id=$2",
        [restaurantId, chatId],
    );
    const stored = rows[0]?.order_draft;
    return {
        revision: stored?.revision ?? null,
        draft: stored && stored.expiresAt > Date.now() ? stored : null,
    };
}

export async function saveWhatsAppOrderDraft(
    { restaurantId, chatId }: WhatsAppOrderChat,
    revision: string | null,
    draft: Omit<WhatsAppOrderDraft, "revision" | "expiresAt"> | null,
) {
    const next = draft && { ...draft, revision: randomUUID(), expiresAt: Date.now() + DRAFT_TTL };
    const { rowCount } = await query(
        `UPDATE whatsapp_conversations SET order_draft=$4::jsonb
         WHERE restaurant_id=$1 AND chat_id=$2 AND mode='bot'
           AND order_draft->>'revision' IS NOT DISTINCT FROM $3`,
        [restaurantId, chatId, revision, next && JSON.stringify(next)],
    );
    if (!rowCount) throw new WhatsAppOrderError("A conversa mudou. Confira a sacola e tente novamente.");
    return next;
}

type ConfirmedOrder = WhatsAppOrderChat & { draft: WhatsAppOrderDraft & { quote: NonNullable<WhatsAppOrderDraft["quote"]> }; point: Coordinates | null };
const confirmedOrders = new WeakMap<Request, ConfirmedOrder>();

// The web route can share its normal order path without trusting client headers or JSON.
export function bindWhatsAppOrder(request: Request, checkout: ConfirmedOrder): Request {
    confirmedOrders.set(request, checkout);
    return request;
}

export function confirmedWhatsAppOrder(request: Request) {
    return confirmedOrders.get(request);
}

type OrderDb = Pick<PoolClient, "query">;

export async function lockWhatsAppOrder(client: OrderDb, checkout: ConfirmedOrder) {
    const { restaurantId, chatId, draft } = checkout;
    const { rows } = await client.query<{ order_draft: WhatsAppOrderDraft; enabled: boolean }>(
        `SELECT c.order_draft,
                s.automations->>'ai_enabled'='true' AS enabled
         FROM whatsapp_conversations c JOIN whatsapp_bot_settings s USING (restaurant_id)
         WHERE c.restaurant_id=$1 AND c.chat_id=$2 AND c.mode='bot'
         FOR UPDATE OF c`,
        [restaurantId, chatId],
    );
    const current = rows[0]?.order_draft;
    if (rows[0]?.enabled && current && current.expiresAt > Date.now()) {
        if (current.receipt?.code === draft.quote.code) return current.receipt.orderId;
        if (current.revision === draft.revision && current.quote?.hash === draft.quote.hash) return null;
    }
    throw new WhatsAppOrderError("Este resumo não está mais disponível. Peça um novo resumo para confirmar.");
}

export async function finishWhatsAppOrder(client: OrderDb, checkout: ConfirmedOrder, orderId: string) {
    const { restaurantId, chatId, draft } = checkout;
    await client.query(
        "UPDATE whatsapp_conversations SET order_draft=$3::jsonb WHERE restaurant_id=$1 AND chat_id=$2",
        [restaurantId, chatId, JSON.stringify({
            revision: randomUUID(),
            expiresAt: Date.now() + DRAFT_TTL,
            items: [],
            receipt: { code: draft.quote.code, orderId },
        } satisfies WhatsAppOrderDraft)],
    );
}

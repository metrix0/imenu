import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasTransferValidationPayload = {
    type?: string;
    transfer?: {
        id?: string;
        status?: string;
        value?: number;
        operationType?: string;
        externalReference?: string | null;
        description?: string | null;
        bankAccount?: {
            pixAddressKey?: string | null;
        } | null;
    };
};

type PayoutRow = {
    id: string;
    amount_cents: number;
    status: string;
    asaas_transfer_id: string | null;
    pix_address_key: string | null;
};

type PayoutCandidateRow = PayoutRow & {
    restaurant_name: string;
};

function validWebhookToken(request: Request): boolean {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || "";
    const received = request.headers.get("asaas-access-token")?.trim() || "";
    if (!expected || !received) return false;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
        expectedBuffer.length === receivedBuffer.length &&
        timingSafeEqual(expectedBuffer, receivedBuffer)
    );
}

function normalizePixKey(value: string | null | undefined): string {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("@") || /^[0-9a-f-]{36}$/i.test(raw)) return raw;

    let digits = raw.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("55")) {
        digits = digits.slice(2);
    }
    return digits;
}

function refuse(reason: string, transferId?: string, externalReference?: string) {
    console.warn("[ASAAS_WITHDRAWAL_VALIDATION] Transferência recusada", {
        reason,
        transferId: transferId || null,
        externalReference: externalReference || null,
    });
    return NextResponse.json({ status: "REFUSED", refuseReason: reason });
}

export async function POST(request: Request) {
    if (!process.env.ASAAS_WEBHOOK_TOKEN?.trim()) {
        return NextResponse.json(
            { error: "Webhook não configurado." },
            { status: 503 }
        );
    }

    if (!validWebhookToken(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    let payload: AsaasTransferValidationPayload;
    try {
        payload = (await request.json()) as AsaasTransferValidationPayload;
    } catch {
        return refuse("Payload inválido.");
    }

    if (payload.type !== "TRANSFER" || !payload.transfer) {
        return refuse("Operação não reconhecida pelo iMenu.");
    }

    const transfer = payload.transfer;
    const transferId = String(transfer.id || "").trim();
    const externalReference = String(transfer.externalReference || "").trim();
    const externalReferenceMatch = /^imenu-payout-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
        externalReference
    );
    const payoutIdFromReference = externalReferenceMatch?.[1] || "";

    if (!transferId) {
        return refuse(
            "Transferência sem identificador do Asaas.",
            transferId,
            externalReference
        );
    }

    if (transfer.operationType && transfer.operationType !== "PIX") {
        return refuse(
            "Modalidade de transferência divergente.",
            transferId,
            externalReference
        );
    }

    const value = Number(transfer.value);
    if (!Number.isFinite(value) || value <= 0) {
        return refuse(
            "Valor de transferência inválido.",
            transferId,
            externalReference
        );
    }

    const transferCents = Math.round(value * 100);
    const payoutResult = await query<PayoutRow>(
        `
            SELECT id, amount_cents, status, asaas_transfer_id, pix_address_key
            FROM public.payouts
            WHERE asaas_transfer_id = $1
               OR ($2 <> '' AND id::text = $2)
            ORDER BY CASE WHEN asaas_transfer_id = $1 THEN 0 ELSE 1 END
            LIMIT 1
        `,
        [transferId, payoutIdFromReference]
    );
    let payout = payoutResult.rows[0];

    if (!payout) {
        const candidates = await query<PayoutCandidateRow>(
            `
                SELECT
                    p.id,
                    p.amount_cents,
                    p.status,
                    p.asaas_transfer_id,
                    p.pix_address_key,
                    r.name AS restaurant_name
                FROM public.payouts p
                JOIN public.restaurants r ON r.id = p.restaurant_id
                WHERE p.status = 'processing'
                  AND p.asaas_transfer_id IS NULL
                  AND p.amount_cents = $1
                  AND p.created_at >= NOW() - INTERVAL '10 minutes'
                ORDER BY p.created_at DESC
                LIMIT 10
            `,
            [transferCents]
        );

        const description = String(transfer.description || "").trim();
        let matching: PayoutCandidateRow[] = [];

        if (description) {
            matching = candidates.rows.filter(
                (row) =>
                    `Repasse iMenu - ${row.restaurant_name}`.slice(0, 140) ===
                    description
            );
        }

        if (matching.length === 0) {
            const webhookPixKey = normalizePixKey(transfer.bankAccount?.pixAddressKey);
            if (webhookPixKey) {
                matching = candidates.rows.filter(
                    (row) => normalizePixKey(row.pix_address_key) === webhookPixKey
                );
            }
        }

        if (matching.length === 0 && candidates.rows.length === 1) {
            matching = candidates.rows;
        }

        if (matching.length === 1) {
            payout = matching[0];
        }
    }

    if (!payout) {
        return refuse(
            "Repasse não encontrado no iMenu.",
            transferId,
            externalReference
        );
    }

    if (!["processing", "paid"].includes(payout.status)) {
        return refuse(
            "Repasse não está autorizado para processamento.",
            transferId,
            externalReference
        );
    }

    if (transferCents !== Number(payout.amount_cents)) {
        return refuse(
            "Valor da transferência não corresponde ao repasse registrado.",
            transferId,
            externalReference
        );
    }

    if (payout.asaas_transfer_id && payout.asaas_transfer_id !== transferId) {
        return refuse(
            "Identificador da transferência não corresponde ao repasse registrado.",
            transferId,
            externalReference
        );
    }

    if (!payout.asaas_transfer_id) {
        await query(
            `
                UPDATE public.payouts
                SET asaas_transfer_id = $2
                WHERE id = $1
                  AND asaas_transfer_id IS NULL
            `,
            [payout.id, transferId]
        );
    }

    console.info("[ASAAS_WITHDRAWAL_VALIDATION] Transferência aprovada", {
        payoutId: payout.id,
        transferId,
    });

    return NextResponse.json({ status: "APPROVED" });
}

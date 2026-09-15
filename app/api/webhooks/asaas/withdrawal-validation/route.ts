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
    };
};

type PayoutRow = {
    id: string;
    amount_cents: number;
    status: string;
    asaas_transfer_id: string | null;
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

    const payoutResult = await query<PayoutRow>(
        `
            SELECT id, amount_cents, status, asaas_transfer_id
            FROM public.payouts
            WHERE asaas_transfer_id = $1
               OR ($2 <> '' AND id::text = $2)
            ORDER BY CASE WHEN asaas_transfer_id = $1 THEN 0 ELSE 1 END
            LIMIT 1
        `,
        [transferId, payoutIdFromReference]
    );
    const payout = payoutResult.rows[0];

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

    const transferCents = Math.round(value * 100);
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

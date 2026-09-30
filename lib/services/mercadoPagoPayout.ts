import { query } from "@/lib/database/sql";
import { createPrivateKey, sign as signData } from "node:crypto";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 4;
const STATUS_POLL_ATTEMPTS = 12;
const STATUS_POLL_DELAY_MS = 2_500;

type MercadoPagoPayoutResponse = {
    id?: string;
    status?: string;
    transactions?: Array<{
        id?: string;
        status?: string;
        status_detail?: string;
    }>;
};

type MercadoPagoPayoutTransaction = {
    id?: string;
    external_reference?: string;
    amount?: { currency?: string; value?: number };
    status?: string;
    status_detail?: string;
};

export type MercadoPagoPayoutTransfer = {
    amountCents: number;
    payoutId: string;
    transactionId: string;
    transactionStatus: string;
    statusDetail: string | null;
};

export class MercadoPagoPayoutError extends Error {
    status: number;
    code: string | null;

    constructor(message: string, status = 500, code: string | null = null) {
        super(message);
        this.name = "MercadoPagoPayoutError";
        this.status = status;
        this.code = code;
    }
}

function accessToken(): string {
    const value = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!value) {
        throw new MercadoPagoPayoutError(
            "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
            503
        );
    }
    return value;
}

function privateKey() {
    const raw = process.env.MERCADO_PAGO_PAYOUT_PRIVATE_KEY?.trim();
    if (!raw) {
        throw new MercadoPagoPayoutError(
            "MERCADO_PAGO_PAYOUT_PRIVATE_KEY não configurada.",
            503
        );
    }

    try {
        const key = createPrivateKey(
            raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw
        );
        if (key.asymmetricKeyType !== "ed25519") {
            throw new Error("A chave não é Ed25519.");
        }
        return key;
    } catch (error) {
        throw new MercadoPagoPayoutError(
            error instanceof Error
                ? `MERCADO_PAGO_PAYOUT_PRIVATE_KEY inválida: ${error.message}`
                : "MERCADO_PAGO_PAYOUT_PRIVATE_KEY inválida.",
            503
        );
    }
}

function destinationPix(): { type: string; chave: string } {
    const chave = process.env.ASAAS_PIX_KEY?.trim();
    const configuredType = process.env.ASAAS_PIX_KEY_TYPE?.trim().toUpperCase();

    if (!chave || !configuredType) {
        throw new MercadoPagoPayoutError(
            "ASAAS_PIX_KEY e ASAAS_PIX_KEY_TYPE precisam estar configurados.",
            503
        );
    }

    const type =
        configuredType === "EVP" ? "PIX_CODE" : configuredType;

    if (!["EMAIL", "PHONE", "CPF", "CNPJ", "PIX_CODE"].includes(type)) {
        throw new MercadoPagoPayoutError(
            "ASAAS_PIX_KEY_TYPE inválido para o Payouts do Mercado Pago.",
            503
        );
    }

    return { type, chave };
}

export function assertMercadoPagoPayoutConfigured(): void {
    accessToken();
    privateKey();
    destinationPix();
}

function parsePayload(text: string): any {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

function parseError(payload: any, status: number): MercadoPagoPayoutError {
    const code =
        typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.code === "string"
              ? payload.code
              : null;
    const message =
        payload?.message ||
        payload?.cause?.[0]?.description ||
        payload?.errors?.[0]?.message ||
        code ||
        `Mercado Pago Payouts retornou HTTP ${status}.`;

    return new MercadoPagoPayoutError(String(message), status, code);
}

async function request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${path}`, {
            ...init,
            headers: {
                accept: "application/json",
                Authorization: `Bearer ${accessToken()}`,
                ...(init.body ? { "content-type": "application/json" } : {}),
                ...(init.headers || {}),
            },
            cache: "no-store",
            signal: controller.signal,
        });
        const payload = parsePayload(await response.text());

        if (!response.ok) {
            throw parseError(payload, response.status);
        }

        return payload as T;
    } catch (error) {
        if (error instanceof MercadoPagoPayoutError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
            throw new MercadoPagoPayoutError(
                "Tempo limite excedido ao chamar o Mercado Pago Payouts.",
                504
            );
        }
        throw new MercadoPagoPayoutError(
            error instanceof Error
                ? error.message
                : "Falha de rede ao chamar o Mercado Pago Payouts.",
            502
        );
    } finally {
        clearTimeout(timeout);
    }
}

function signBody(body: string): string {
    return signData(null, Buffer.from(body, "utf8"), privateKey()).toString(
        "base64"
    );
}

function terminalFailure(status: string): boolean {
    return ["error", "rejected", "canceled", "cancelled", "refunded"].includes(
        status.toLowerCase()
    );
}

export function isMercadoPagoPayoutComplete(status: string, statusDetail: string): boolean {
    const normalizedStatus = status.toLowerCase();
    const normalizedDetail = statusDetail.toLowerCase();

    return (
        (normalizedStatus === "processed" && normalizedDetail === "approved") ||
        (normalizedStatus === "success" &&
            normalizedDetail === "accredited")
    );
}

export async function getMercadoPagoPayoutTransaction(
    payoutId: string,
    transactionId: string
): Promise<MercadoPagoPayoutTransaction> {
    return request<MercadoPagoPayoutTransaction>(
        `/v1/payouts/${encodeURIComponent(
            payoutId
        )}/transactions/${encodeURIComponent(transactionId)}`
    );
}

async function pollTransaction(
    payoutId: string,
    transactionId: string,
    initialStatus: string,
    amountCents: number,
    externalReference: string
): Promise<MercadoPagoPayoutTransaction> {
    let latest: MercadoPagoPayoutTransaction = {
        id: transactionId,
        status: initialStatus,
    };

    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
            await new Promise((resolve) =>
                setTimeout(resolve, STATUS_POLL_DELAY_MS)
            );
        }

        try {
            latest = await getMercadoPagoPayoutTransaction(payoutId, transactionId);
        } catch (error) {
            if (attempt === STATUS_POLL_ATTEMPTS - 1) throw error;
            continue;
        }

        if (latest.id !== transactionId || latest.amount?.currency !== "BRL" ||
            Math.round(Number(latest.amount.value) * 100) !== amountCents || latest.external_reference !== externalReference) {
            throw new MercadoPagoPayoutError("Resposta de transferência Mercado Pago divergente.", 502);
        }
        const status = String(latest.status || "");
        const statusDetail = String(latest.status_detail || "");
        if (isMercadoPagoPayoutComplete(status, statusDetail)) return latest;
        if (terminalFailure(status)) {
            throw new MercadoPagoPayoutError(
                `Transferência Mercado Pago falhou: ${latest.status_detail || status}.`,
                502,
                latest.status_detail || status
            );
        }
    }

    return latest;
}

export async function transferMercadoPagoToAsaas(input: {
    amountCents: number;
    clientReference: string;
    onCreated?: (transfer: MercadoPagoPayoutTransfer) => Promise<void>;
}): Promise<MercadoPagoPayoutTransfer | null> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) {
        throw new MercadoPagoPayoutError("Valor de transferência inválido.", 400);
    }
    const amountCents = input.amountCents;
    if (amountCents === 0) return null;
    if (amountCents < 100) {
        throw new MercadoPagoPayoutError(
            "O Mercado Pago exige payout mínimo de R$ 1,00.",
            409
        );
    }

    const pix = destinationPix();
    const externalReference = input.clientReference
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 64);

    const body = JSON.stringify({
        external_reference: externalReference,
        description: "iMenu - repasse de saldo para Asaas",
        transactions: [
            {
                description: "iMenu - saldo para repasses",
                type: "pix",
                pix,
                amount: {
                    currency: "BRL",
                    value: amountCents / 100,
                },
                external_reference: `${externalReference}-asaas`.slice(0, 64),
            },
        ],
    });

    let payload: MercadoPagoPayoutResponse | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            payload = await request<MercadoPagoPayoutResponse>("/v1/payouts", {
                method: "POST",
                headers: {
                    "X-Idempotency-Key": externalReference,
                    "X-enforce-signature": "true",
                    "X-signature": signBody(body),
                },
                body,
            });
            break;
        } catch (error) {
            lastError = error;
            const retryable =
                error instanceof MercadoPagoPayoutError &&
                (error.status === 409 ||
                    error.status === 429 ||
                    error.status >= 500);

            if (!retryable || attempt === MAX_ATTEMPTS) throw error;
            await new Promise((resolve) =>
                setTimeout(resolve, 500 * attempt)
            );
        }
    }

    if (!payload) {
        throw lastError instanceof Error
            ? lastError
            : new MercadoPagoPayoutError(
                  "O Mercado Pago não confirmou a criação do payout.",
                  502
              );
    }

    const payoutId = String(payload.id || "");
    const transaction = payload.transactions?.[0];
    const transactionId = String(transaction?.id || "");

    if (!payoutId || !transactionId) {
        throw new MercadoPagoPayoutError(
            "O Mercado Pago não retornou os identificadores do payout.",
            502
        );
    }

    await input.onCreated?.({ amountCents, payoutId, transactionId,
        transactionStatus: String(transaction?.status || payload.status || "created"),
        statusDetail: transaction?.status_detail || null });

    const latest = await pollTransaction(
        payoutId,
        transactionId,
        String(transaction?.status || payload.status || "created"),
        amountCents,
        `${externalReference}-asaas`.slice(0, 64)
    );

    return {
        amountCents,
        payoutId,
        transactionId,
        transactionStatus: String(
            latest.status || transaction?.status || payload.status || "created"
        ),
        statusDetail: latest.status_detail || transaction?.status_detail || null,
    };
}

// Legacy column names are preserved; the reference prefix identifies MP funding.
export async function reconcileMercadoPagoFunding(currentRunId: string): Promise<void> {
    const pending = await query<{
        id: string; payzu_transaction_id: string | null; transferred_cents: number;
        payzu_client_reference: string;
    }>(`SELECT id, payzu_transaction_id, transferred_cents, payzu_client_reference
        FROM public.payout_automation_runs
        WHERE id <> $1 AND payzu_client_reference LIKE 'imenu-mp-daily-payout-%'
          AND transferred_cents > 0 AND payzu_step_status NOT IN ('completed', 'skipped')
        ORDER BY started_at`, [currentRunId]);
    for (const run of pending.rows) {
        const ids = run.payzu_transaction_id?.split("/");
        if (!ids || ids.length !== 2) {
            throw new Error(`Transferência Mercado Pago ${run.payzu_client_reference} sem confirmação. Reconcilie essa referência antes de transferir novamente.`);
        }
        const transaction = await getMercadoPagoPayoutTransaction(ids[0], ids[1]);
        if (transaction.id !== ids[1] || transaction.amount?.currency !== "BRL" ||
            Math.round(Number(transaction.amount.value) * 100) !== Number(run.transferred_cents) ||
            transaction.external_reference !== `${run.payzu_client_reference}-asaas`.slice(0, 64)) {
            throw new Error("Transferência Mercado Pago anterior divergente.");
        }
        const complete = isMercadoPagoPayoutComplete(transaction.status || "", transaction.status_detail || "");
        if (!complete && !terminalFailure(transaction.status || "")) {
            throw new Error(`Transferência Mercado Pago ${ids[0]} ainda pendente. Nenhuma nova transferência foi criada.`);
        }
        await query(`UPDATE public.payout_automation_runs SET payzu_step_status = $2,
            payzu_transaction_status = $3, transferred_cents = CASE WHEN $2 = 'skipped' THEN 0 ELSE transferred_cents END,
            updated_at = NOW() WHERE id = $1`,
            [run.id, complete ? "completed" : "skipped", `${transaction.status}:${transaction.status_detail || ""}`]);
    }
}

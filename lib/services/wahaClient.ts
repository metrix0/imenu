type WahaSessionStatus =
    | "STOPPED"
    | "STARTING"
    | "SCAN_QR_CODE"
    | "PASSKEY_REQUIRED"
    | "PASSKEY_CONFIRMATION_REQUIRED"
    | "WORKING"
    | "FAILED";

export type WahaSession = {
    name: string;
    status: WahaSessionStatus;
    me?: {
        id?: string | null;
        pushName?: string | null;
    } | null;
    config?: Record<string, unknown> | null;
};

export type WahaListRow = {
    title: string;
    rowId: string;
    description?: string | null;
};

type WahaQrResponse = {
    mimetype?: string;
    data?: string;
};

class WahaHttpError extends Error {
    status: number;
    responseBody: string;

    constructor(status: number, responseBody: string) {
        super(`WAHA returned HTTP ${status}`);
        this.name = "WahaHttpError";
        this.status = status;
        this.responseBody = responseBody;
    }
}

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function getWahaBaseUrl(): string {
    return getRequiredEnv("WAHA_API_URL").replace(/\/+$/, "");
}

function getWahaApiKey(): string {
    return getRequiredEnv("WAHA_API_KEY");
}

export function getWahaWebhookHmacKey(): string {
    return getRequiredEnv("WAHA_WEBHOOK_HMAC_KEY");
}

export function getIMenuPublicUrl(): string {
    const configured = process.env.IMENU_PUBLIC_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");

    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

    throw new Error(
        "Missing IMENU_PUBLIC_URL (for example https://app.seudominio.com)"
    );
}

export function buildWahaSessionName(restaurantId: string): string {
    return `imenu-${restaurantId.toLowerCase()}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!response.ok) {
        throw new WahaHttpError(response.status, text);
    }

    if (!text) return undefined as T;

    try {
        return JSON.parse(text) as T;
    } catch {
        return text as T;
    }
}

async function wahaRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("X-Api-Key", getWahaApiKey());
    headers.set("Accept", "application/json");

    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${getWahaBaseUrl()}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });

    return parseResponse<T>(response);
}

function sessionConfig(restaurantId: string) {
    return {
        metadata: {
            restaurant_id: restaurantId,
        },
        ignore: {
            status: true,
            groups: true,
            channels: true,
            broadcast: true,
        },
        webhooks: [
            {
                url: `${getIMenuPublicUrl()}/api/webhooks/waha`,
                events: [
                    "message",
                    "message.any",
                    "session.status",
                ],
                hmac: {
                    key: getWahaWebhookHmacKey(),
                },
                retries: {
                    policy: "exponential",
                    delaySeconds: 2,
                    attempts: 8,
                },
            },
        ],
    };
}

export async function getWahaSession(
    sessionName: string
): Promise<WahaSession | null> {
    try {
        return await wahaRequest<WahaSession>(
            `/api/sessions/${encodeURIComponent(sessionName)}`
        );
    } catch (error) {
        if (error instanceof WahaHttpError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function ensureWahaSession(
    restaurantId: string,
    sessionName: string
): Promise<WahaSession> {
    const existing = await getWahaSession(sessionName);
    const config = sessionConfig(restaurantId);

    if (!existing) {
        return wahaRequest<WahaSession>("/api/sessions", {
            method: "POST",
            body: JSON.stringify({
                name: sessionName,
                start: true,
                config,
            }),
        });
    }

    const updated = await wahaRequest<WahaSession>(
        `/api/sessions/${encodeURIComponent(sessionName)}`,
        {
            method: "PUT",
            body: JSON.stringify({
                name: sessionName,
                config,
            }),
        }
    );

    return updated.status === "STOPPED"
        ? startWahaSession(sessionName)
        : updated;
}

export async function startWahaSession(
    sessionName: string
): Promise<WahaSession> {
    return wahaRequest<WahaSession>(
        `/api/sessions/${encodeURIComponent(sessionName)}/start`,
        { method: "POST" }
    );
}

export async function restartWahaSession(
    sessionName: string
): Promise<WahaSession> {
    return wahaRequest<WahaSession>(
        `/api/sessions/${encodeURIComponent(sessionName)}/restart`,
        { method: "POST" }
    );
}

export async function logoutWahaSession(sessionName: string): Promise<void> {
    await wahaRequest<void>(
        `/api/sessions/${encodeURIComponent(sessionName)}/logout`,
        { method: "POST" }
    );
}

export async function getWahaQrCode(
    sessionName: string
): Promise<string | null> {
    try {
        const qr = await wahaRequest<WahaQrResponse>(
            `/api/${encodeURIComponent(sessionName)}/auth/qr?format=image`,
            {
                headers: {
                    Accept: "application/json",
                },
            }
        );

        if (!qr?.data) return null;
        if (qr.data.startsWith("data:")) return qr.data;

        return `data:${qr.mimetype || "image/png"};base64,${qr.data}`;
    } catch (error) {
        if (
            error instanceof WahaHttpError &&
            [404, 409, 422].includes(error.status)
        ) {
            return null;
        }
        throw error;
    }
}

export async function sendWahaText(
    sessionName: string,
    chatId: string,
    text: string
): Promise<void> {
    await wahaRequest<void>("/api/sendText", {
        method: "POST",
        body: JSON.stringify({
            session: sessionName,
            chatId,
            text,
            linkPreview: true,
        }),
    });
}

export async function sendWahaList(
    sessionName: string,
    chatId: string,
    rows: WahaListRow[]
): Promise<void> {
    await wahaRequest<void>("/api/sendList", {
        method: "POST",
        body: JSON.stringify({
            session: sessionName,
            chatId,
            reply_to: null,
            message: {
                title: "Atendimento iMenu",
                description: "Escolha uma opção para continuar:",
                footer: "Toque em uma opção abaixo",
                button: "Ver opções",
                sections: [
                    {
                        title: "Como posso ajudar?",
                        rows: rows.map((row) => ({
                            title: row.title,
                            rowId: row.rowId,
                            description: row.description ?? null,
                        })),
                    },
                ],
            },
        }),
    });
}

export function extractWahaPhone(meId: unknown): string | null {
    const digits = String(meId || "").split("@")[0].replace(/\D/g, "");
    return digits || null;
}

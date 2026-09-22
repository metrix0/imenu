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

type WahaLidResponse = {
    lid?: string | null;
    pn?: string | null;
};

type WahaMessageMedia = {
    url?: string | null;
    mimetype?: string | null;
    filename?: string | null;
    error?: unknown;
};

type WahaMessageWithMedia = {
    media?: WahaMessageMedia | null;
    mediaUrl?: string | null;
};

export type WahaDownloadedMedia = {
    data: Buffer;
    mimetype: string;
    filename: string;
};

const WAHA_SEND_TIMEOUT_MS = 5_000;
const WAHA_MEDIA_TIMEOUT_MS = 15_000;
const MAX_WAHA_MEDIA_BYTES = 12 * 1024 * 1024;
const WAHA_TYPING_TIMEOUT_MS = 1_000;

export const SUPPORT_WAHA_SESSION_NAME = "imenu-support";

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
    init: RequestInit = {},
    timeoutMs = 20_000
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
        signal: AbortSignal.timeout(timeoutMs),
    });

    return parseResponse<T>(response);
}

function getSupportPublicUrl(): string {
    const configured = process.env.IMENU_SUPPORT_PUBLIC_URL?.trim();
    return configured ? configured.replace(/\/+$/, "") : getIMenuPublicUrl();
}

function sessionConfig(
    metadata: Record<string, string>,
    publicUrl = getIMenuPublicUrl()
) {
    return {
        metadata,
        ignore: {
            status: true,
            groups: true,
            channels: true,
            broadcast: true,
        },
        webhooks: [
            {
                url: `${publicUrl}/api/webhooks/waha`,
                events: ["message", "message.any", "session.status"],
                hmac: {
                    key: getWahaWebhookHmacKey(),
                },
                retries: {
                    policy: "exponential",
                    delaySeconds: 2,
                    attempts: 2,
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

async function ensureWahaSessionWithConfig(
    sessionName: string,
    config: Record<string, unknown>
): Promise<WahaSession> {
    const existing = await getWahaSession(sessionName);

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

    // Never update a healthy restaurant session during a status check or
    // repeated connect request. Updating GOWS config can restart it.
    if (existing.status === "WORKING") {
        return existing;
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

export async function ensureWahaSession(
    restaurantId: string,
    sessionName: string
): Promise<WahaSession> {
    return ensureWahaSessionWithConfig(
        sessionName,
        sessionConfig({ restaurant_id: restaurantId })
    );
}

export async function ensureWahaSupportSession(
    sessionName = SUPPORT_WAHA_SESSION_NAME
): Promise<WahaSession> {
    return ensureWahaSessionWithConfig(
        sessionName,
        sessionConfig({ support: "true" }, getSupportPublicUrl())
    );
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

export async function startWahaTyping(
    sessionName: string,
    chatId: string
): Promise<void> {
    await wahaRequest<void>(
        "/api/startTyping",
        {
            method: "POST",
            body: JSON.stringify({
                session: sessionName,
                chatId,
            }),
        },
        WAHA_TYPING_TIMEOUT_MS
    );
}

export async function stopWahaTyping(
    sessionName: string,
    chatId: string
): Promise<void> {
    await wahaRequest<void>(
        "/api/stopTyping",
        {
            method: "POST",
            body: JSON.stringify({
                session: sessionName,
                chatId,
            }),
        },
        WAHA_TYPING_TIMEOUT_MS
    );
}

function inferWahaMediaMimeType(filename: string): string {
    const extension = filename.toLowerCase().split(".").pop();
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    if (extension === "gif") return "image/gif";
    if (extension === "ogg" || extension === "oga" || extension === "opus") {
        return "audio/ogg";
    }
    if (extension === "mp3") return "audio/mpeg";
    if (extension === "m4a" || extension === "mp4") return "audio/mp4";
    if (extension === "wav") return "audio/wav";
    if (extension === "webm") return "audio/webm";
    return "application/octet-stream";
}

function resolveWahaMediaUrl(value: string): URL {
    const base = new URL(getWahaBaseUrl());
    const url = new URL(value, base);

    if (
        url.pathname.startsWith("/api/files/") ||
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
        return new URL(url.pathname + url.search, base);
    }

    return url;
}

export async function getWahaMessageMedia(
    sessionName: string,
    chatId: string,
    messageId: string
): Promise<WahaDownloadedMedia | null> {
    const message = await wahaRequest<WahaMessageWithMedia>(
        `/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}?downloadMedia=true`,
        {},
        WAHA_MEDIA_TIMEOUT_MS
    );
    const rawUrl = message.media?.url || message.mediaUrl;
    if (!rawUrl) return null;

    const url = resolveWahaMediaUrl(rawUrl);
    const wahaOrigin = new URL(getWahaBaseUrl()).origin;
    const headers = new Headers({ Accept: "*/*" });
    if (url.origin === wahaOrigin) {
        headers.set("X-Api-Key", getWahaApiKey());
    }

    const response = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(WAHA_MEDIA_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`WAHA media download returned HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_WAHA_MEDIA_BYTES
    ) {
        throw new Error("WAHA media file is too large");
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_WAHA_MEDIA_BYTES) {
        throw new Error("WAHA media file is too large");
    }

    const pathFilename = decodeURIComponent(
        url.pathname.split("/").pop() || ""
    );
    const filename =
        message.media?.filename?.trim() || pathFilename || "media";
    const mimetype =
        (
            message.media?.mimetype ||
            response.headers.get("content-type") ||
            inferWahaMediaMimeType(filename)
        )
            .split(";")[0]
            .trim()
            .toLowerCase() || inferWahaMediaMimeType(filename);

    return { data, mimetype, filename };
}

export async function sendWahaText(
    sessionName: string,
    chatId: string,
    text: string
): Promise<unknown> {
    return wahaRequest<unknown>(
        "/api/sendText",
        {
            method: "POST",
            body: JSON.stringify({
                session: sessionName,
                chatId,
                text,
                linkPreview: true,
            }),
        },
        WAHA_SEND_TIMEOUT_MS
    );
}

function sendWahaListRequest(
    sessionName: string,
    chatId: string,
    rows: WahaListRow[]
): Promise<unknown> {
    return wahaRequest<unknown>(
        "/api/sendList",
        {
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
        },
        WAHA_SEND_TIMEOUT_MS
    );
}

async function getPhoneChatIdForLid(
    sessionName: string,
    chatId: string
): Promise<string | null> {
    if (!chatId.endsWith("@lid")) return null;

    try {
        const result = await wahaRequest<WahaLidResponse>(
            `/api/${encodeURIComponent(sessionName)}/lids/${encodeURIComponent(chatId)}`,
            {},
            WAHA_SEND_TIMEOUT_MS
        );
        return typeof result?.pn === "string" && result.pn.trim()
            ? result.pn.trim()
            : null;
    } catch {
        return null;
    }
}

export async function resolveWahaChatPhone(
    sessionName: string,
    chatId: string
): Promise<string | null> {
    const resolvedChatId = chatId.endsWith("@lid")
        ? await getPhoneChatIdForLid(sessionName, chatId)
        : chatId;

    if (!resolvedChatId) return null;
    const digits = String(resolvedChatId)
        .split("@")[0]
        .replace(/\D/g, "");
    return digits || null;
}
export async function sendWahaList(
    sessionName: string,
    chatId: string,
    rows: WahaListRow[]
): Promise<unknown> {
    try {
        return await sendWahaListRequest(sessionName, chatId, rows);
    } catch (error) {
        if (
            !(error instanceof WahaHttpError) ||
            error.status !== 500 ||
            !chatId.endsWith("@lid")
        ) {
            throw error;
        }

        const phoneChatId = await getPhoneChatIdForLid(sessionName, chatId);
        if (!phoneChatId || phoneChatId === chatId) throw error;

        return sendWahaListRequest(sessionName, phoneChatId, rows);
    }
}

export function extractWahaPhone(meId: unknown): string | null {
    const digits = String(meId || "").split("@")[0].replace(/\D/g, "");
    return digits || null;
}

import { withTransaction } from "@/lib/database/sql";
import type { PoolClient } from "pg";
import { emptyDeliveryConfig, seal, unseal, type DeliveryConfig, type IfoodConnection } from "./providers";

const base = "https://merchant-api.ifood.com.br";
export class IfoodConnectionError extends Error {
    constructor(message: string, public status = 409) { super(message); }
}
export function ifoodAppAvailable() {
    return Boolean(process.env.IFOOD_CLIENT_ID?.trim() && process.env.IFOOD_CLIENT_SECRET?.trim());
}
function appCredentials() {
    if (!ifoodAppAvailable()) throw new IfoodConnectionError("A conexão com o iFood está indisponível. Tente novamente mais tarde.", 503);
    return { clientId: process.env.IFOOD_CLIENT_ID!.trim(), clientSecret: process.env.IFOOD_CLIENT_SECRET!.trim() };
}
// The same lock is used by settings autosave. Always merge against the latest encrypted record.
export async function updateIfood<T>(restaurantId: string, callback: (config: DeliveryConfig, client: PoolClient) => Promise<T>): Promise<T> {
    return withTransaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`delivery-config:${restaurantId}`]);
        const { rows } = await client.query("SELECT credentials FROM delivery_integrations WHERE restaurant_id=$1", [restaurantId]);
        const config = rows[0] ? unseal(rows[0].credentials) : structuredClone(emptyDeliveryConfig);
        const result = await callback(config, client);
        await client.query(`INSERT INTO delivery_integrations(restaurant_id,credentials,ifood_merchant_id,ifood_enabled)
            VALUES($1,$2,$3,$4) ON CONFLICT(restaurant_id) DO UPDATE SET credentials=EXCLUDED.credentials,
            ifood_merchant_id=EXCLUDED.ifood_merchant_id,ifood_enabled=EXCLUDED.ifood_enabled,updated_at=now()`,
            [restaurantId, seal(config), config.ifood.merchantId || null, config.ifood.enabled]);
        return result;
    });
}
async function tokenRequest(values: Record<string, string>) {
    const response = await fetch(`${base}/authentication/v1.0/oauth/token`, {
        method: "POST", body: new URLSearchParams({ ...appCredentials(), ...values }),
        cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new IfoodConnectionError(response.status >= 500 || response.status === 429
        ? "O iFood está indisponível. Tente novamente em instantes."
        : "A autorização do iFood expirou ou é inválida. Conecte novamente.", response.status >= 500 || response.status === 429 ? 503 : 409);
    const data = await response.json();
    if (typeof data.accessToken !== "string" || !data.accessToken || data.accessToken.length > 8000 ||
        !Number.isFinite(Number(data.expiresIn)) || Number(data.expiresIn) <= 0 ||
        (data.refreshToken !== undefined && (typeof data.refreshToken !== "string" || !data.refreshToken || data.refreshToken.length > 8000)))
        throw new IfoodConnectionError("O iFood não confirmou a autorização. Tente novamente.", 503);
    return { accessToken: data.accessToken as string, refreshToken: data.refreshToken as string | undefined,
        expiresAt: Date.now() + Number(data.expiresIn) * 1000 };
}
export async function startIfoodConnection(restaurantId: string) {
    const { clientId } = appCredentials();
    return updateIfood(restaurantId, async config => {
        const old = config.ifood.connection?.pending;
        if (old && !old.accessToken && old.expiresAt > Date.now() + 30000) return publicPending(old);
        const response = await fetch(`${base}/authentication/v1.0/oauth/userCode`, {
            method: "POST", body: new URLSearchParams({ clientId }), cache: "no-store", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new IfoodConnectionError("Não foi possível iniciar a conexão com o iFood. Tente novamente.", 503);
        const data = await response.json();
        const url = new URL(data.verificationUrlComplete);
        if (url.origin !== "https://portal.ifood.com.br" || url.pathname !== "/apps/code" ||
            typeof data.userCode !== "string" || !data.userCode || typeof data.authorizationCodeVerifier !== "string" ||
            !data.authorizationCodeVerifier || !Number.isFinite(Number(data.expiresIn)) || Number(data.expiresIn) <= 0)
            throw new IfoodConnectionError("O iFood não retornou uma autorização válida. Tente novamente.", 503);
        const pending = { userCode: data.userCode, verifier: data.authorizationCodeVerifier, url: url.href,
            expiresAt: Date.now() + Number(data.expiresIn) * 1000 };
        config.ifood.connection = { ...config.ifood.connection, restaurantId, pending };
        return publicPending(pending);
    });
}
function publicPending(pending: NonNullable<IfoodConnection["pending"]>) {
    return { userCode: pending.userCode, url: pending.url, expiresAt: pending.expiresAt, merchants: pending.merchants || [] };
}
export function publicIfood(config: DeliveryConfig["ifood"]) {
    const connection = config.connection;
    const connected = Boolean(config.merchantId && (connection?.refreshToken || (config.clientId && config.clientSecret)));
    return { connected, enabled: connected && config.enabled, merchantName: connection?.merchantName || config.merchantId, lastError: connection?.lastError || "",
        pending: connection?.pending && connection.pending.expiresAt > Date.now() ? publicPending(connection.pending) : null };
}
async function merchantsForToken(accessToken: string) {
    const merchants: { id: string; name: string }[] = [];
    for (let page = 1; page <= 100; page++) {
        const response = await fetch(`${base}/merchant/v1.0/merchants?page=${page}&size=100`, {
            headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new IfoodConnectionError("Não foi possível consultar suas lojas no iFood. Tente novamente em instantes.", 503);
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.some(row => !/^[a-f0-9-]{36}$/i.test(row.id || "") || typeof row.name !== "string"))
            throw new IfoodConnectionError("O iFood retornou lojas inválidas. Tente novamente.", 503);
        merchants.push(...rows.map(row => ({ id: row.id as string, name: row.name as string })));
        if (rows.length < 100) return merchants;
    }
    throw new IfoodConnectionError("Não foi possível listar todas as lojas do iFood.", 503);
}
export async function finishIfoodConnection(restaurantId: string, authorizationCode: string, merchantId?: string) {
    // Persist issued tokens before discovery, so a transient merchant-list failure does not consume the code twice.
    await updateIfood(restaurantId, async config => {
        const pending = config.ifood.connection?.pending;
        if (!pending || pending.expiresAt <= Date.now()) throw new IfoodConnectionError("A autorização expirou. Clique em Conectar iFood novamente.");
        if (pending.accessToken) return;
        if (!authorizationCode || authorizationCode.length > 1000) throw new IfoodConnectionError("Cole o código de autorização exibido pelo iFood.", 400);
        const token = await tokenRequest({ grantType: "authorization_code", authorizationCode, authorizationCodeVerifier: pending.verifier });
        if (!token.refreshToken) throw new IfoodConnectionError("O aplicativo iFood não permite esta conexão. Tente novamente mais tarde.", 503);
        Object.assign(pending, { accessToken: token.accessToken, refreshToken: token.refreshToken,
            tokenExpiresAt: token.expiresAt, expiresAt: token.expiresAt });
        pending.verifier = "";
    });
    return updateIfood(restaurantId, async (config, client) => {
        const pending = config.ifood.connection?.pending;
        if (!pending?.accessToken || !pending.refreshToken || !pending.tokenExpiresAt || pending.tokenExpiresAt <= Date.now())
            throw new IfoodConnectionError("A autorização expirou. Conecte novamente.");
        const merchants = await merchantsForToken(pending.accessToken);
        if (!merchants.length) throw new IfoodConnectionError("A loja ainda não apareceu na autorização do iFood. Aguarde alguns minutos e tente concluir novamente.");
        const merchant = merchantId ? merchants.find(item => item.id === merchantId) : merchants.length === 1 ? merchants[0] : undefined;
        if (merchantId && !merchant) throw new IfoodConnectionError("Essa loja não foi autorizada no iFood.", 403);
        if (!merchant) { pending.merchants = merchants; return publicIfood(config.ifood); }
        const duplicate = await client.query("SELECT restaurant_id FROM delivery_integrations WHERE ifood_merchant_id=$1 AND restaurant_id<>$2", [merchant.id, restaurantId]);
        if (duplicate.rows.length) throw new IfoodConnectionError("Esta loja do iFood já está conectada a outro restaurante.");
        config.ifood = { enabled: true, merchantId: merchant.id, clientId: "", clientSecret: "", connection: {
            restaurantId, accessToken: pending.accessToken, refreshToken: pending.refreshToken,
            expiresAt: pending.tokenExpiresAt, merchantName: merchant.name,
        } };
        return publicIfood(config.ifood);
    });
}
export async function ifoodAccessToken(restaurantId: string, rejectedToken?: string): Promise<string> {
    return updateIfood(restaurantId, async config => {
        const connection = config.ifood.connection;
        if (!config.ifood.enabled || !connection?.refreshToken) throw new IfoodConnectionError("Conecte sua loja ao iFood novamente.");
        if (connection.accessToken && (connection.expiresAt || 0) > Date.now() + 60000 && connection.accessToken !== rejectedToken) return connection.accessToken;
        const token = await tokenRequest({ grantType: "refresh_token", refreshToken: connection.refreshToken });
        connection.accessToken = token.accessToken;
        connection.refreshToken = token.refreshToken || connection.refreshToken;
        connection.expiresAt = token.expiresAt;
        return token.accessToken;
    });
}
export async function ifoodApi(restaurantId: string, path: string, options: RequestInit = {}) {
    let token = await ifoodAccessToken(restaurantId);
    const send = () => fetch(`${base}${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` },
        cache: "no-store", signal: AbortSignal.timeout(10000) });
    let response = await send();
    if (response.status === 401) { token = await ifoodAccessToken(restaurantId, token); response = await send(); }
    if (!response.ok) throw new IfoodConnectionError(`O iFood recusou a solicitação (${response.status}). Tente novamente.`, response.status === 429 || response.status >= 500 ? 503 : 409);
    return response;
}

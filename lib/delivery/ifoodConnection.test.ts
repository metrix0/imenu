import { query, withTransaction } from "@/lib/database/sql";
import { emptyDeliveryConfig, seal, unseal, type DeliveryConfig } from "./providers";
import { finishIfoodConnection, ifoodAccessToken, ifoodApi, publicIfood, startIfoodConnection } from "./ifoodConnection";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
let saved: DeliveryConfig;
const restaurant = "restaurant";
const merchant = { id: "11111111-1111-4111-8111-111111111111", name: "Minha loja" };
const other = { id: "22222222-2222-4222-8222-222222222222", name: "Outra loja" };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const mockedFetch = () => fetch as jest.Mock;
beforeEach(() => {
    jest.resetAllMocks();
    process.env.DELIVERY_INTEGRATIONS_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.IFOOD_CLIENT_ID = "app-client"; process.env.IFOOD_CLIENT_SECRET = "app-secret";
    saved = structuredClone(emptyDeliveryConfig);
    const client = { query: jest.fn(async (sql: string, args?: any[]) => {
        if (sql.startsWith("SELECT credentials")) return { rows: [{ credentials: seal(saved) }] };
        if (sql.startsWith("SELECT restaurant_id")) return (query as jest.Mock)(sql, args);
        if (sql.startsWith("INSERT")) saved = unseal(args![1]);
        return { rows: [], rowCount: 1 };
    }) };
    (withTransaction as jest.Mock).mockImplementation(callback => callback(client));
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    global.fetch = jest.fn();
});
async function start() {
    mockedFetch().mockResolvedValueOnce(respond({ userCode: "AAAA-BBBB", authorizationCodeVerifier: "private-verifier",
        verificationUrlComplete: "https://portal.ifood.com.br/apps/code?c=AAAA-BBBB", expiresIn: 600 }));
    return startIfoodConnection(restaurant);
}
function authorize(merchants = [merchant]) {
    mockedFetch().mockResolvedValueOnce(respond({ accessToken: "private-access", refreshToken: "private-refresh", expiresIn: 3600 }))
        .mockResolvedValueOnce(respond(merchants));
}
test("start returns the provider authorization link and keeps verifier only encrypted server-side", async () => {
    const result = await start();
    expect(result.url).toBe("https://portal.ifood.com.br/apps/code?c=AAAA-BBBB");
    expect(JSON.stringify(result)).not.toContain("private-verifier");
    expect(saved.ifood.enabled).toBe(false);
    expect(saved.ifood.connection?.pending?.verifier).toBe("private-verifier");
    expect(mockedFetch().mock.calls[0][1].body.get("clientId")).toBe("app-client");
});
test("missing app configuration fails clearly without a provider request", async () => {
    delete process.env.IFOOD_CLIENT_SECRET;
    await expect(startIfoodConnection(restaurant)).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
});
test("untrusted authorization URLs are rejected before storing or returning them", async () => {
    mockedFetch().mockResolvedValueOnce(respond({ userCode: "AAAA", authorizationCodeVerifier: "private",
        verificationUrlComplete: "https://evil.example/apps/code", expiresIn: 600 }));
    await expect(startIfoodConnection(restaurant)).rejects.toThrow();
    expect(saved.ifood.connection).toBeUndefined();
});
test("authorization connects the sole verified merchant without exposing or asking for credentials", async () => {
    await start(); authorize();
    const result = await finishIfoodConnection(restaurant, "RETURN-CODE");
    expect(result).toMatchObject({ connected: true, enabled: true, merchantName: merchant.name, pending: null });
    expect(saved.ifood.merchantId).toBe(merchant.id);
    expect(saved.ifood.clientSecret).toBe("");
    expect(saved.ifood.connection?.refreshToken).toBe("private-refresh");
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(mockedFetch().mock.calls[1][1].body.get("authorizationCodeVerifier")).toBe("private-verifier");
    expect(mockedFetch().mock.calls[1][1].body.get("grantType")).toBe("authorization_code");
});
test("multiple merchants require explicit selection and forged merchant IDs cannot connect", async () => {
    await start(); authorize([merchant, other]);
    const result = await finishIfoodConnection(restaurant, "CODE");
    expect(result.connected).toBe(false);
    expect(result.pending?.merchants).toEqual([merchant, other]);
    mockedFetch().mockResolvedValueOnce(respond([merchant, other]));
    await expect(finishIfoodConnection(restaurant, "", "33333333-3333-4333-8333-333333333333")).rejects.toMatchObject({ status: 403 });
    expect(saved.ifood.enabled).toBe(false);
    mockedFetch().mockResolvedValueOnce(respond([merchant, other]));
    await finishIfoodConnection(restaurant, "", other.id);
    expect(saved.ifood.merchantId).toBe(other.id);
});
test("token survives a merchant-list failure and retry does not exchange the consumed code again", async () => {
    await start();
    mockedFetch().mockResolvedValueOnce(respond({ accessToken: "access", refreshToken: "refresh", expiresIn: 3600 }))
        .mockResolvedValueOnce(respond({}, 503));
    await expect(finishIfoodConnection(restaurant, "CODE")).rejects.toThrow();
    expect(saved.ifood.connection?.pending?.refreshToken).toBe("refresh");
    mockedFetch().mockResolvedValueOnce(respond([merchant]));
    await finishIfoodConnection(restaurant, "CODE");
    expect(mockedFetch().mock.calls.filter(([url]) => url.endsWith("/oauth/token"))).toHaveLength(1);
    expect(saved.ifood.enabled).toBe(true);
});
test("expired authorization codes cannot connect", async () => {
    await start(); saved.ifood.connection!.pending!.expiresAt = Date.now() - 1;
    await expect(finishIfoodConnection(restaurant, "CODE")).rejects.toThrow(/expirou/);
    expect(fetch).toHaveBeenCalledTimes(1);
});
test("a merchant linked to a different restaurant is rejected", async () => {
    await start(); authorize(); (query as jest.Mock).mockResolvedValue({ rows: [{ restaurant_id: "other" }] });
    await expect(finishIfoodConnection(restaurant, "CODE")).rejects.toThrow(/outro restaurante/);
    expect(saved.ifood.enabled).toBe(false);
});
test("access tokens are reused then refreshed durably with rotated refresh tokens", async () => {
    saved.ifood = { enabled: true, merchantId: merchant.id, clientId: "", clientSecret: "", connection: {
        restaurantId: restaurant, accessToken: "old", refreshToken: "refresh", expiresAt: Date.now() + 3600000 } };
    expect(await ifoodAccessToken(restaurant)).toBe("old"); expect(fetch).not.toHaveBeenCalled();
    saved.ifood.connection!.expiresAt = Date.now();
    mockedFetch().mockResolvedValueOnce(respond({ accessToken: "new", refreshToken: "rotated", expiresIn: 7200 }));
    expect(await ifoodAccessToken(restaurant)).toBe("new");
    expect(saved.ifood.connection?.refreshToken).toBe("rotated");
    expect(mockedFetch().mock.calls[0][1].body.get("grantType")).toBe("refresh_token");
    expect(await ifoodAccessToken(restaurant)).toBe("new"); expect(fetch).toHaveBeenCalledTimes(1);
});
test("401 refreshes the token once and retries the same provider request", async () => {
    saved.ifood = { enabled: true, merchantId: merchant.id, clientId: "", clientSecret: "", connection: {
        restaurantId: restaurant, accessToken: "old", refreshToken: "refresh", expiresAt: Date.now() + 3600000 } };
    mockedFetch().mockResolvedValueOnce(respond({}, 401)).mockResolvedValueOnce(respond({ accessToken: "new", expiresIn: 3600 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await ifoodApi(restaurant, "/events/v1.0/events:polling")).status).toBe(204);
    expect(mockedFetch().mock.calls[2][1].headers.Authorization).toBe("Bearer new");
    expect(publicIfood(saved.ifood)).not.toHaveProperty("refreshToken");
});

import { createClient } from "@supabase/supabase-js";
import { authorize } from "../authorize";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));

const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
] as const;
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

const mockCreateClient = createClient as jest.Mock;
const request = (authorization?: string) => new Request("https://example.com/api/dev/dashboard", {
    headers: authorization ? { authorization } : {},
});

function mockUser(user: { email?: string; id?: string } | null, error: Error | null = null) {
    mockCreateClient.mockReturnValue({
        auth: {
            getUser: jest.fn(async () => ({ data: { user }, error })),
        },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    mockUser({ email: "joaovralmeida@hotmail.com" });
});

afterAll(() => {
    for (const key of keys) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

it("returns 401 without a bearer token, without contacting Supabase", async () => {
    const response = await authorize(request());
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Não autenticado." });
    expect(mockCreateClient).not.toHaveBeenCalled();
});

it("returns 401 when the token cannot identify a user", async () => {
    mockUser(null, new Error("expired"));
    const response = await authorize(request("Bearer expired"));
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Sessão inválida ou expirada." });
});

it("returns 403 for a different email", async () => {
    mockUser({ email: "someone@example.com" });
    const response = await authorize(request("Bearer token"));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "Acesso negado." });
});

it("allows the developer account, ignoring email case and whitespace", async () => {
    mockUser({ email: "  JOaOVRALMEIDA@HOTMAIL.COM  " });
    const response = await authorize(request("  bEaReR token  "));
    expect(response).toBeNull();
    expect(mockCreateClient).toHaveBeenCalledWith(
        "https://example.supabase.co",
        "anon",
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
});

it("keeps existing missing-Supabase-config behavior", async () => {
    for (const key of keys) delete process.env[key];
    await expect(authorize(request("Bearer token"))).rejects.toThrow(
        "Supabase public environment variables are missing."
    );
});

it("preserves denied developer access logging when a route requests it", async () => {
    const logDenied = jest.fn();
    mockUser({ id: "other-user", email: "external@example.com" });
    const response = await authorize(request("Bearer token"), logDenied);
    expect(response?.status).toBe(403);
    expect(logDenied).toHaveBeenCalledWith({
        id: "other-user",
        email: "external@example.com",
    });
    logDenied.mockClear();
    mockUser({ id: "authorized", email: "joaovralmeida@hotmail.com" });
    expect(await authorize(request("Bearer token"), logDenied)).toBeNull();
    expect(logDenied).not.toHaveBeenCalled();
});

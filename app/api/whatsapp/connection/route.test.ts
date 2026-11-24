import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

jest.mock("@/lib/database/supabaseServerClient", () => ({
    createSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/services/wahaClient", () => ({}));
jest.mock("@/lib/services/whatsappPairingCleanup", () => ({}));

const restaurantId = "30000000-0000-4000-8000-000000000001";

async function request(method: "GET" | "POST", token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `http://localhost/api/whatsapp/connection?restaurantId=${restaurantId}`;
    if (method === "GET") return GET(new NextRequest(url, { headers }));
    return POST(new NextRequest(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ restaurantId, action: "connect" }),
    }));
}

it.each(["GET", "POST"] as const)("%s explains missing authentication", async (method) => {
    const response = await request(method);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
        error: "Sessão inválida ou expirada. Saia e entre novamente no iMenu.",
    });
});

it.each(["GET", "POST"] as const)("%s explains expired authentication", async (method) => {
    (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: { getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "JWT expired" },
        }) },
    });

    const response = await request(method, "expired-token");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
        error: "Sessão inválida ou expirada. Saia e entre novamente no iMenu.",
    });
});

it.each(["GET", "POST"] as const)("%s explains unavailable restaurants without leaking details", async (method) => {
    const restaurantQuery: Record<string, jest.Mock> = {
        select: jest.fn(),
        eq: jest.fn(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    restaurantQuery.select.mockReturnValue(restaurantQuery);
    restaurantQuery.eq.mockReturnValue(restaurantQuery);
    (createSupabaseServerClient as jest.Mock).mockReturnValue({
        auth: { getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "owner" } },
            error: null,
        }) },
        from: jest.fn().mockReturnValue(restaurantQuery),
    });

    const response = await request(method, "valid-token");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
        error: "Restaurante não encontrado ou sem acesso.",
    });
});

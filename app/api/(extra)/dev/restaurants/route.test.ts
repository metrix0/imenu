import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { authorize } from "@/lib/dev/authorize";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/dev/authorize", () => ({ authorize: jest.fn() }));

const mockQuery = query as jest.Mock;
const mockAuthorize = authorize as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorize.mockResolvedValue(null);
});

it("returns account details when searching restaurants by email", async () => {
    const restaurant = {
        id: "restaurant-1",
        name: "Exemplo",
        url_slug: "exemplo",
        phone: "11988887777",
        store_whatsapp: "11999998888",
        user_id: "owner-1",
        owner_email: "proprietario@example.com",
        owner_name: "João",
        created_at: "2026-10-01T12:00:00Z",
        custom_domain: "exemplo.com.br",
        last_sign_in_at: "2026-10-20T12:00:00Z",
    };
    mockQuery.mockResolvedValue({ rows: [restaurant], rowCount: 1 });

    const response = await GET(new Request(
        "https://example.com/api/dev/restaurants?q=proprietario%40example.com",
        { headers: { Authorization: "Bearer token" } }
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ restaurants: [restaurant] });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("LEFT JOIN auth.users AS u ON u.id = r.user_id");
    expect(sql).toContain("u.email ILIKE $1");
    expect(sql).toContain("AS owner_name");
    expect(sql).toContain("r.custom_domain");
    expect(sql).toContain("u.last_sign_in_at");
    expect(params[0]).toBe("%proprietario@example.com%");
    expect(mockAuthorize).toHaveBeenCalledTimes(1);
});

it("requires developer authorization before exposing details", async () => {
    const { NextResponse } = await import("next/server");
    mockAuthorize.mockResolvedValue(NextResponse.json(
        { error: "Acesso negado." }, { status: 403 }
    ));
    const response = await GET(new Request("https://example.com/api/dev/restaurants?q=exemplo"));
    expect(response.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
});

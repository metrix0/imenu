import { NextRequest } from "next/server";
import { query } from "@/lib/database/sql";
import { requireOwnedRestaurant } from "@/lib/push/auth";
import { POST } from "./route";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/push/auth", () => ({ requireOwnedRestaurant: jest.fn() }));

const restaurantId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const deviceToken = "a".repeat(40);
const endpoint = "https://push.example.com/subscription-new";

function request(): NextRequest {
    return new NextRequest("https://imenuapp.com.br/api/push/subscriptions", {
        method: "POST",
        headers: { Authorization: "Bearer session", "Content-Type": "application/json" },
        body: JSON.stringify({
            restaurantId,
            deviceToken,
            subscription: { endpoint, keys: { p256dh: "public-key", auth: "auth-key" } },
        }),
    });
}

beforeEach(() => {
    jest.resetAllMocks();
    (requireOwnedRestaurant as jest.Mock).mockResolvedValue({ userId, restaurantId });
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: "existing-or-created-id" }], rowCount: 1 });
});

test("re-registers an existing device token in place without deleting subscriptions", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(query).toHaveBeenCalledTimes(1);

    const [sql, params] = (query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WITH updated_by_token AS");
    expect(sql).toContain("UPDATE owner_push_subscriptions");
    expect(sql).toMatch(/WHERE restaurant_id = \$1\s+AND user_id = \$2\s+AND device_token = \$6/);
    expect(sql).toContain("SET endpoint = $3");
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM updated_by_token)");
    expect(sql).not.toContain("DELETE FROM owner_push_subscriptions");
    expect(params.slice(0, 6)).toEqual([restaurantId, userId, endpoint, "public-key", "auth-key", deviceToken]);
});

test("preserves new registrations and existing endpoint updates for the same owner", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    const [sql] = (query as jest.Mock).mock.calls[0] as [string];
    expect(sql).toContain("INSERT INTO owner_push_subscriptions");
    expect(sql).toContain("ON CONFLICT (endpoint)");
    expect(sql).toContain("p256dh = EXCLUDED.p256dh");
    expect(sql).toContain("device_token = EXCLUDED.device_token");
    expect(sql).toContain("owner_push_subscriptions.user_id = EXCLUDED.user_id");
    expect(sql).toContain("owner_push_subscriptions.restaurant_id = EXCLUDED.restaurant_id");
});

test("does not report success when an endpoint belongs to another account", async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(query).toHaveBeenCalledTimes(1);
});

test("returns a safe conflict for a duplicate token without modifying other subscriptions", async () => {
    (query as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error("duplicate key"), {
            code: "23505", constraint: "owner_push_subscriptions_device_token_key",
        })
    );
    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(query).toHaveBeenCalledTimes(1);
});

test("rejects unauthorised owners before writing a subscription", async () => {
    (requireOwnedRestaurant as jest.Mock).mockRejectedValueOnce(
        new Response("Unauthorized", { status: 401 })
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
});

import { NextRequest } from "next/server";
import { POST } from "./route";
import { query, withTransaction } from "@/lib/database/sql";
import { requireOwnedRestaurant } from "@/lib/push/auth";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/push/auth", () => ({ requireOwnedRestaurant: jest.fn() }));
const token = "a".repeat(40), restaurantId = "10000000-0000-4000-8000-000000000001", userId = "20000000-0000-4000-8000-000000000002", endpoint = "https://fcm.googleapis.com/send/renewed";
let client: {
    query: jest.Mock;
};
beforeEach(() => { (requireOwnedRestaurant as jest.Mock).mockResolvedValue({ restaurantId, userId }); client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }; (withTransaction as jest.Mock).mockImplementation(fn => fn(client)); });
function send() { return POST(new NextRequest("https://imenu.test/api/push/subscriptions", { method: "POST", body: JSON.stringify({ restaurantId, deviceToken: token, subscription: { endpoint, keys: { p256dh: "public", auth: "secret" } } }) })); }
test("renewal replaces previous endpoint and clears cross-account queues transactionally", async () => { expect((await send()).status).toBe(200); expect(withTransaction).toHaveBeenCalledTimes(1); expect(query).not.toHaveBeenCalled(); const c = client.query.mock.calls; expect(c[0][0]).toContain("pg_advisory_xact_lock"); expect(c[1][1]).toEqual([token, endpoint]); expect(c[2][1]).toEqual([endpoint, restaurantId, userId]); expect(c[3][0]).toContain("ON CONFLICT (endpoint)"); });
test("registration changes require authorization", async () => { (requireOwnedRestaurant as jest.Mock).mockRejectedValue(new Response("Unauthorized", { status: 401 })); expect((await send()).status).toBe(401); expect(withTransaction).not.toHaveBeenCalled(); });
test("database failure cannot claim successful activation", async () => { jest.spyOn(console, "error").mockImplementation(() => undefined); client.query.mockRejectedValueOnce(new Error("offline")); expect((await send()).status).toBe(500); jest.restoreAllMocks(); });

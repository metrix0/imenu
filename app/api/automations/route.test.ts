import { NextRequest } from "next/server";
import { GET, PATCH, PUT } from "./route";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn().mockResolvedValue({ user: { id: "owner" } }),
    RestaurantOwnerAuthError: class extends Error {},
}));
jest.mock("@/lib/services/crmAutomations", () => ({ automationOffers: jest.fn().mockResolvedValue([]) }));

beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [] });
});

test("a non-Plus owner cannot save marketing settings through the API", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
    const response = await PUT(new NextRequest("http://localhost/api/automations?restaurantId=restaurant", { method: "PUT", body: "{}" }));
    expect(response.status).toBe(402);
    expect((await response.json()).code).toBe("IA_PLUS_REQUIRED");
    expect(query).not.toHaveBeenCalled();
});

test.each([false, true])("settings expose Plus=%s without writing during page load", async (plus) => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(plus);
    const response = await GET(new NextRequest("http://localhost/api/automations?restaurantId=restaurant"));
    expect(response.status).toBe(200);
    expect((await response.json()).plus).toBe(plus);
    expect((query as jest.Mock).mock.calls.every(([sql]) => !/INSERT|UPDATE|DELETE/.test(sql))).toBe(true);
});

test("an active Plus owner can save marketing settings", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    const response = await PUT(new NextRequest("http://localhost/api/automations?restaurantId=restaurant", { method: "PUT", body: "{}" }));
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO whatsapp_bot_settings"), expect.any(Array));
});

function toggleRequest(body: object) {
    return new NextRequest("http://localhost/api/automations?restaurantId=restaurant", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

test("quick settings enforce the Plus gate", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
    const response = await PATCH(toggleRequest({ kind: "habit", enabled: true }));
    expect(response.status).toBe(402);
    expect(query).not.toHaveBeenCalled();
});

test("changing a marketing switch patches one flag and checks its existing offer", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ restaurant_id: "restaurant" }] });
    const response = await PATCH(toggleRequest({ kind: "cart", enabled: true }));
    expect(response.status).toBe(200);
    expect((await response.json()).enabled).toBe(true);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("jsonb_build_object('enabled', $3::boolean)"), ["restaurant", "cart", true, null]);
});

test("an unavailable offer blocks enabling without blocking disabling", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ automations: { cart: { offer: "unavailable" } }, offer: '"unavailable"' }],
    }).mockResolvedValueOnce({ rows: [{ restaurant_id: "restaurant" }] });
    expect((await PATCH(toggleRequest({ kind: "cart", enabled: true }))).status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
    expect((await PATCH(toggleRequest({ kind: "cart", enabled: false }))).status).toBe(200);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO whatsapp_bot_settings"), ["restaurant", "cart", false, null]);
});

test("rejects a kind outside the marketing switches", async () => {
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    expect((await PATCH(toggleRequest({ kind: "ai_enabled", enabled: true }))).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});

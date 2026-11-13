import { POST, DELETE } from "./route";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { startIfoodConnection, finishIfoodConnection, updateIfood } from "@/lib/delivery/ifoodConnection";
jest.mock("@/lib/auth/restaurantOwner", () => ({ requireRestaurantOwner: jest.fn(),
    RestaurantOwnerAuthError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
jest.mock("@/lib/delivery/ifoodConnection", () => ({ startIfoodConnection: jest.fn(), finishIfoodConnection: jest.fn(), updateIfood: jest.fn(),
    IfoodConnectionError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
beforeEach(() => { jest.resetAllMocks(); });
test.each([POST, DELETE])("other owners cannot authorize or disconnect a restaurant", async handler => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(new RestaurantOwnerAuthError("Acesso negado.", 403));
    const response = await handler(new Request("https://local", { method: "POST", body: JSON.stringify({ restaurantId: "other", action: "start" }) }));
    expect(response.status).toBe(403);
    expect(startIfoodConnection).not.toHaveBeenCalled(); expect(finishIfoodConnection).not.toHaveBeenCalled(); expect(updateIfood).not.toHaveBeenCalled();
});
test("rejects arbitrary actions and malformed merchant choices", async () => {
    for (const body of [{ action: "arbitrary" }, { action: "select", merchantId: "forged" }]) {
        const response = await POST(new Request("https://local", { method: "POST", body: JSON.stringify({ restaurantId: "restaurant", ...body }) }));
        expect(response.status).toBe(400);
    }
    expect(finishIfoodConnection).not.toHaveBeenCalled();
});

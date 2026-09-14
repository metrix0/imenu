import { GET, PATCH } from "./route";
import { query } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => {
    class RestaurantOwnerAuthError extends Error { constructor(message: string, public status: number) { super(message); } }
    return { requireRestaurantOwner: jest.fn(), RestaurantOwnerAuthError };
});
const context = { params: Promise.resolve({ id: "restaurant" }) };
const category = "10000000-0000-4000-8000-000000000001";
const settings = { enabled: true, pricing_rule: "average", max_flavors: 3, category_ids: [category] };
const request = (body: unknown = settings) => new Request("https://example.test/api/restaurants/restaurant/pizza", { method: "PATCH", body: JSON.stringify(body), headers: { Authorization: "Bearer test" } });
beforeEach(() => { jest.clearAllMocks(); (requireRestaurantOwner as jest.Mock).mockResolvedValue({}); (query as jest.Mock).mockResolvedValue({ rows: [{ id: category }] }); });
it("requires ownership before loading or changing settings", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(new RestaurantOwnerAuthError("Acesso negado.", 403));
    expect((await GET(request(), context)).status).toBe(403);
    expect((await PATCH(request(), context)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});
it("rejects categories from another restaurant", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    expect((await PATCH(request(), context)).status).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
});
it.each([1, 9, 2.5])("rejects invalid maximum %s without a database write", async max_flavors => {
    expect((await PATCH(request({ ...settings, max_flavors }), context)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});
it("persists settings only for the authorized restaurant", async () => {
    expect((await PATCH(request(), context)).status).toBe(200);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE restaurants"), ["restaurant", JSON.stringify(settings)]);
});

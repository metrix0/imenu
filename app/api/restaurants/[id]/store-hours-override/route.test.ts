import { PATCH } from "./route";
import { query } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn(),
    RestaurantOwnerAuthError: class extends Error {
        constructor(message: string, public status: number) { super(message); }
    },
}));

const context = { params: Promise.resolve({ id: "restaurant" }) };
const call = (action: string) => PATCH(new Request("http://localhost/override", {
    method: "PATCH", body: JSON.stringify({ action }),
}), context);

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-11-16T01:00:00Z"));
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({ user: { id: "owner" } });
    (query as jest.Mock).mockResolvedValue({ rows: [{ is_closed: null, manual_open_until: null }] });
});
afterEach(() => jest.useRealTimers());

test.each([
    ["open", null, "2026-11-16T03:00:00.000Z"],
    ["close", "2026-11-16T01:00:00.000Z", null],
    ["resume", null, null],
])("updates both override fields atomically for %s", async (action, closed, open) => {
    expect((await call(action)).status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE id = $1 AND user_id = $2"),
        ["restaurant", "owner", closed, open]);
});

test("rejects an unauthorized request before updating the restaurant", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(new RestaurantOwnerAuthError("Acesso negado.", 403));
    expect((await call("open")).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});

test("rejects an invalid action without updating any field", async () => {
    expect((await call("forever")).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});


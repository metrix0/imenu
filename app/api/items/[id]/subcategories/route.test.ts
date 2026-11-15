import { PATCH } from "./route";
import { getAuthenticatedUser, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { withTransaction } from "@/lib/database/sql";

jest.mock("@/lib/auth/restaurantOwner", () => ({
  ...jest.requireActual("@/lib/auth/restaurantOwner"),
  getAuthenticatedUser: jest.fn(),
}));
jest.mock("@/lib/database/sql", () => ({ withTransaction: jest.fn() }));

const itemId = "00000000-0000-4000-8000-000000000001";
const first = "00000000-0000-4000-8000-000000000002";
const second = "00000000-0000-4000-8000-000000000003";
const foreign = "00000000-0000-4000-8000-000000000004";
const db = { query: jest.fn() };
const reorder = (groupIds: string[]) => PATCH(new Request("http://localhost/items", {
  method: "PATCH",
  body: JSON.stringify({ groupIds }),
}), { params: Promise.resolve({ id: itemId }) });

beforeEach(() => {
  db.query.mockReset()
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: first }, { id: second }] })
    .mockResolvedValueOnce({ rowCount: 2 });
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: "owner" } as Awaited<ReturnType<typeof getAuthenticatedUser>>);
  jest.mocked(withTransaction).mockImplementation(async callback => callback(db as never));
});

it("saves the requested order in one item-scoped update", async () => {
  expect((await reorder([second, first])).status).toBe(200);
  expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining("restaurant.user_id = $2"), [itemId, "owner"]);
  expect(db.query).toHaveBeenNthCalledWith(3, expect.stringContaining("WITH ORDINALITY"), [itemId, [second, first]]);
});

it("rejects missing authentication", async () => {
  jest.mocked(getAuthenticatedUser).mockRejectedValueOnce(new RestaurantOwnerAuthError("Não autenticado.", 401));
  expect((await reorder([second, first])).status).toBe(401);
  expect(db.query).not.toHaveBeenCalled();
});

it("rejects items outside the owner's restaurant", async () => {
  db.query.mockReset().mockResolvedValueOnce({ rowCount: 0 });
  expect((await reorder([second, first])).status).toBe(403);
  expect(db.query).toHaveBeenCalledTimes(1);
});

it("rejects stale or foreign groups before updating any positions", async () => {
  expect((await reorder([first, foreign])).status).toBe(409);
  expect(db.query).toHaveBeenCalledTimes(2);
});

it("rejects duplicate groups before opening a transaction", async () => {
  expect((await reorder([first, first])).status).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

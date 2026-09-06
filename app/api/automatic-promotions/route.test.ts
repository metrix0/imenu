import { GET, PUT, DELETE } from "./route";
import {
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/auth/restaurantOwner", () => ({
  ...jest.requireActual("@/lib/auth/restaurantOwner"),
  requireRestaurantOwner: jest.fn(),
}));

const restaurantId = "30000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const promotion = {
  id,
  name: "Oferta",
  active: true,
  show_on_menu: true,
  delivery: true,
  mesa: false,
  allow_coupon: false,
  rules: [],
  benefits: [{ type: "delivery" }],
};
const request = (method: string, body?: unknown) =>
  new Request(
    `https://preview.imenuapp.com.br/api/automatic-promotions?restaurantId=${restaurantId}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );

beforeEach(() => {
  (requireRestaurantOwner as jest.Mock).mockResolvedValue({
    restaurant: { id: restaurantId },
  });
  (query as jest.Mock).mockResolvedValue({ rows: [] });
});

it.each(["GET", "PUT", "DELETE"])(
  "denies %s for a user who does not own the restaurant",
  async (method) => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(
      new RestaurantOwnerAuthError("Acesso negado.", 403),
    );
    const response = await (method === "GET"
      ? GET(request(method))
      : method === "PUT"
        ? PUT(request(method, { restaurantId, promotion }))
        : DELETE(request(method, { restaurantId, id })));
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  },
);

it("rejects product references belonging to another restaurant", async () => {
  const response = await PUT(
    request("PUT", {
      restaurantId,
      promotion: {
        ...promotion,
        rules: [{ type: "product", item_id: id, quantity: 1 }],
      },
    }),
  );
  expect(response.status).toBe(400);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("restaurant_id = $1"),
    [restaurantId, [id]],
  );
  expect(withTransaction).not.toHaveBeenCalled();
});

it("updates one promotion while preserving other promotions under a row lock", async () => {
  const other = {
    ...promotion,
    id: "20000000-0000-4000-8000-000000000002",
    name: "Outra",
  };
  const client = {
    query: jest
      .fn()
      .mockResolvedValue({
        rows: [{ automatic_promotions: [promotion, other] }],
      }),
  };
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(client));
  const response = await PUT(
    request("PUT", {
      restaurantId,
      promotion: { ...promotion, name: "Editada" },
    }),
  );
  expect(response.status).toBe(200);
  expect(client.query.mock.calls[0][0]).toContain("FOR UPDATE");
  expect(JSON.parse(client.query.mock.calls[1][1][1])).toEqual([
    { ...promotion, name: "Editada" },
    other,
  ]);
});

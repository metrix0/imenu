import { authorize, failure } from "../http";
import {
  requireRestaurantOwner,
  getAuthenticatedUser,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
jest.mock("@/lib/auth/restaurantOwner", () => ({
  requireRestaurantOwner: jest.fn(),
  getAuthenticatedUser: jest.fn(),
  RestaurantOwnerAuthError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
test("explicit restaurant always requires authenticated ownership", async () => {
  (requireRestaurantOwner as jest.Mock).mockRejectedValue(
    new RestaurantOwnerAuthError("Acesso negado.", 403),
  );
  await expect(
    authorize(new Request("https://example.test"), id),
  ).rejects.toThrow("Acesso negado.");
  expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), id);
  expect(query).not.toHaveBeenCalled();
});
test("implicit restaurant is resolved only from authenticated user", async () => {
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({
    id: "verified-user",
  });
  (query as jest.Mock).mockResolvedValue({ rows: [{ id }] });
  (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
  expect(await authorize(new Request("https://example.test"))).toBe(id);
  expect((query as jest.Mock).mock.calls[0][1]).toEqual(["verified-user"]);
  expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), id);
});
test("unexpected errors never disclose raw database details", async () => {
  const response = failure(new Error("password=secret connection failed"));
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});

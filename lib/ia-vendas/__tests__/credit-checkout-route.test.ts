import { POST } from "@/app/api/ia-vendas/credits/checkout/route";
import { authorize } from "@/lib/ia-vendas/http";
import { createCreditPurchasePayment } from "@/lib/ia-vendas/creditPayments";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";

jest.mock("@/lib/ia-vendas/http", () => ({
  authorize: jest.fn(),
  failure: (error: Error & { status?: number }) =>
    Response.json({ error: error.message }, { status: error.status || 500 }),
}));
jest.mock("@/lib/ia-vendas/creditPayments", () => ({
  createCreditPurchasePayment: jest.fn(),
}));
jest.mock("@/lib/auth/restaurantOwner", () => ({
  requireRestaurantOwner: jest.fn(),
}));

const restaurantId = "30000000-0000-4000-8000-000000000001";
const requestId = "c7f1e4a1-1111-4111-8111-122222222222";
const body = {
  restaurant_id: restaurantId,
  requestId,
  inputTokens: 1_000_000,
  images: 0,
  priceCents: 164,
  paymentMethod: "pix",
};

function send(overrides: Record<string, unknown> = {}) {
  return POST(new Request("https://imenu.example/api/ia-vendas/credits/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner-token" },
    body: JSON.stringify({ ...body, ...overrides }),
  }));
}

beforeEach(() => {
  (authorize as jest.Mock).mockReset().mockResolvedValue(restaurantId);
  (requireRestaurantOwner as jest.Mock).mockReset().mockResolvedValue({
    user: { email: "owner@example.test" },
    restaurant: { name: "Restaurante de Teste" },
  });
  (createCreditPurchasePayment as jest.Mock).mockReset().mockResolvedValue({
    active: false,
    recurring: false,
    paymentMethod: "pix",
    paymentStatus: "pending",
    transactionId: "purchase-1",
    qrCodeText: "000201-Pix-test",
  });
});

test("AI-credit checkout passes the quoted R$1.64 unchanged to Pix and returns the QR code", async () => {
  const response = await send();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    transactionId: "purchase-1",
    paymentMethod: "pix",
    paymentStatus: "pending",
    qrCodeText: "000201-Pix-test",
  });
  expect(authorize).toHaveBeenCalledWith(expect.any(Request), restaurantId);
  expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurantId);
  expect(createCreditPurchasePayment).toHaveBeenCalledWith({
    restaurantId,
    requestId,
    inputTokens: 1_000_000,
    images: 0,
    priceCents: 164,
    payerEmail: "owner@example.test",
    payerName: "Restaurante de Teste",
    origin: process.env.NEXT_PUBLIC_BASE_URL || "https://imenu.example",
  });
});

test.each(["credit_card", "boleto", null])("AI-credit checkout disallows payment method %s", async (method) => {
  const response = await send({ paymentMethod: method });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/Forma de pagamento inválida/);
  expect(createCreditPurchasePayment).not.toHaveBeenCalled();
});

test("unauthenticated checkout cannot create a Pix charge", async () => {
  (authorize as jest.Mock).mockRejectedValue(Object.assign(new Error("Não autenticado."), { status: 401 }));
  const response = await send();
  expect(response.status).toBe(401);
  expect(createCreditPurchasePayment).not.toHaveBeenCalled();
});

test("stale prices return a conflict instead of silently charging a different amount", async () => {
  (createCreditPurchasePayment as jest.Mock).mockRejectedValue(
    Object.assign(new Error("O preço foi atualizado. Revise o valor antes de pagar."), { status: 409 }),
  );
  const response = await send();
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("Revise o valor");
  expect(createCreditPurchasePayment).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 164 }));
});

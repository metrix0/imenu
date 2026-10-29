import { after } from "next/server";
import { notifyOrderReady } from "@/lib/push/server";
jest.mock("next/server", () => ({ ...jest.requireActual("next/server"), after: jest.fn() }));
jest.mock("@/lib/push/server", () => ({ notifyOrderReady: jest.fn() }));
import { POST } from "./route";
import { query, withTransaction } from "@/lib/database/sql";
import { createMercadoPagoPixCharge } from "@/lib/payments/mercadoPagoPix";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import type { AutomaticPromotion } from "@/lib/promotions/automatic";

jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ createMercadoPagoPixCharge: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
  ...jest.requireActual("@/lib/auth/restaurantOwner"),
  requireRestaurantOwner: jest.fn(),
}));

const restaurantId = "30000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000001";
const tableId = "40000000-0000-4000-8000-000000000001";
const orderId = "50000000-0000-4000-8000-000000000001";
const offer: AutomaticPromotion = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Especial",
  active: true,
  show_on_menu: true,
  delivery: true,
  mesa: true,
  allow_coupon: false,
  rules: [],
  benefits: [{ type: "fixed", cents: 500 }, { type: "delivery" }],
};
const body = {
  restaurantId,
  customer_name: "Cliente de teste",
  customer_phone: "11999990000",
  items: [
    {
      base_item_id: itemId,
      name: "Produto",
      qty: 1,
      unit_price_cents: 5000,
      total_cents: 5000,
      selectedSubitems: [],
    },
  ],
  delivery_fee_cents: 800,
  paymentMethod: "dinheiro",
  is_delivery: "entrega",
};
let offers: AutomaticPromotion[];
let stock: number;
let activeProductPromotion: { type: "percent" | "fixed"; value: number } | null;
let giftProductEnabled: boolean;
const giftId = "10000000-0000-4000-8000-000000000002";
let insert: any[] | null;
let writes: string[];
let transactions: string[];
let client: { query: jest.Mock };

beforeEach(() => {
  (after as jest.Mock).mockReset();
  (notifyOrderReady as jest.Mock).mockReset();
  (requireRestaurantOwner as jest.Mock).mockReset().mockResolvedValue({});
  offers = [offer];
  stock = 10;
  activeProductPromotion = null;
  giftProductEnabled = false;
  insert = null;
  writes = [];
  transactions = [];
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
  (createMercadoPagoPixCharge as jest.Mock).mockResolvedValue({
    id: "payment-test",
    qrCodeBase64: null,
    qrCodeText: "test",
  });
  client = {
    query: jest.fn(async (sql: string, values: any[]) => {
      if (/INSERT|UPDATE/.test(sql) && !sql.includes("FOR UPDATE"))
        writes.push(sql);
      if (sql.includes("SELECT url_slug, automatic_promotions"))
        return { rows: [{ url_slug: "teste", automatic_promotions: offers }] };
      if (sql.includes("LEFT JOIN promotions"))
        return {
          rows: [
            { id: itemId, name: "Produto", price_cents: 5000, is_available: true, promotion: activeProductPromotion },
            ...(giftProductEnabled ? [{ id: giftId, name: "Brinde", price_cents: 1200, is_available: true }] : []),
          ],
        };
      if (sql.includes("FROM promotions p"))
        return { rows: activeProductPromotion ? [{ item_id: itemId, ...activeProductPromotion }] : [] };
      if (sql.includes("FROM public.restaurant_tables AS table_entry"))
        return { rows: [{ id: tableId, name: "Mesa 1" }] };
      if (/FROM items\s+WHERE id/.test(sql))
        return {
          rows: [
            {
              id: values?.[0] === giftId ? giftId : itemId,
              restaurant_id: restaurantId,
              name: values?.[0] === giftId ? "Brinde" : "Produto",
              is_available: true,
              stock_enabled: true,
              stock_quantity: stock,
            },
          ],
        };
      if (sql.includes("INSERT INTO orders")) {
        insert = values;
        return { rows: [{ id: orderId }] };
      }
      if (sql.includes("INSERT INTO order_items"))
        return { rows: [{ id: "order-item-test" }] };
      if (/SELECT\s+id,\s+restaurant_id,\s+customer_phone/.test(sql))
        return {
          rows: [
            {
              id: orderId,
              restaurant_id: restaurantId,
              status: "pending_online_payment",
              payment_ref: null,
              loyalty_points_used: 0,
            },
          ],
        };
      if (sql.includes("SELECT item_id, quantity"))
        return { rows: [{ item_id: itemId, quantity: 1 }] };
      return { rows: [], rowCount: 1 };
    }),
  };
  (withTransaction as jest.Mock).mockImplementation(async (fn) => {
    try {
      const result = await fn(client);
      transactions.push("commit");
      return result;
    } catch (error) {
      transactions.push("rollback");
      throw error;
    }
  });
});
afterEach(() => jest.restoreAllMocks());

const send = (patch: Record<string, any> = {}, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://preview.imenuapp.com.br/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...body, ...patch }),
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
const saved = () => insert as unknown as any[];

const enablePreorders = () => {
  (query as jest.Mock).mockImplementation(async (sql: string) =>
    sql.includes("SELECT preorder_only, preorder_availability_json")
      ? { rows: [{ preorder_only: true, delivery_disabled: false }] }
      : { rows: [], rowCount: 1 },
  );
};

it("requires a schedule for customer checkout in preorder-only mode", async () => {
  enablePreorders();
  const response = await send();
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/agendar/);
  expect(requireRestaurantOwner).not.toHaveBeenCalled();
  expect(insert).toBeNull();
});

it("allows an unscheduled manual order for the authenticated restaurant owner", async () => {
  enablePreorders();
  const response = await send({ panel_order: true }, { Authorization: "Bearer owner-token" });
  expect(response.status).toBe(200);
  expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurantId);
  expect(insert).not.toBeNull();
});

it("rejects a manual-order flag without owner authentication", async () => {
  enablePreorders();
  (requireRestaurantOwner as jest.Mock).mockRejectedValueOnce(
    new RestaurantOwnerAuthError("Não autenticado.", 401),
  );
  const response = await send({ panel_order: true });
  expect(response.status).toBe(401);
  expect(insert).toBeNull();
});

it("rejects a manual order for another restaurant", async () => {
  enablePreorders();
  (requireRestaurantOwner as jest.Mock).mockRejectedValueOnce(
    new RestaurantOwnerAuthError("Acesso negado.", 403),
  );
  const response = await send({ panel_order: true }, { Authorization: "Bearer non-owner-token" });
  expect(response.status).toBe(403);
  expect(insert).toBeNull();
});

it("reprices panel orders with current individual product promotions", async () => {
  offers = [];
  activeProductPromotion = { type: "percent", value: 20 };
  const response = await send({
    panel_order: true,
    expected_promotion: { id: null, total_cents: 4800 },
  });
  expect(response.status).toBe(200);
  expect(saved()[2]).toBe(4000);
  expect(saved()[4]).toBe(4800);
});

it("creates a panel order with a real free-product promotion line", async () => {
  giftProductEnabled = true;
  offers = [{ ...offer, benefits: [{ type: "product", item_id: giftId, quantity: 1 }] }];
  const response = await send({
    panel_order: true,
    expected_promotion: { id: offer.id, total_cents: 5800 },
    items: [...body.items, {
      base_item_id: giftId,
      name: "Brinde",
      qty: 1,
      unit_price_cents: 1200,
      total_cents: 0,
      selectedSubitems: [],
      automatic_promotion_id: offer.id,
    }],
  });
  expect(response.status).toBe(200);
  expect(saved()[4]).toBe(5800);
  expect(writes.filter(sql => sql.includes("INSERT INTO order_items"))).toHaveLength(2);
});

it("rejects a gift promotion when the panel omits its free product", async () => {
  giftProductEnabled = true;
  offers = [{ ...offer, benefits: [{ type: "product", item_id: giftId, quantity: 1 }] }];
  const response = await send({
    panel_order: true,
    expected_promotion: { id: offer.id, total_cents: 5800 },
  });
  expect(response.status).toBe(409);
  expect(insert).toBeNull();
});

it("preserves orders with no automatic promotion", async () => {
  offers = [];
  const response = await send();
  expect(response.status).toBe(200);
  expect(saved().slice(1, 5)).toEqual([
    "pending_physical_payment",
    5000,
    800,
    5800,
  ]);
  expect(saved()[15]).toBeNull();
  expect(saved()[18]).toBeNull();
  expect(transactions).toEqual(["commit"]);
  expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("stores the total discount in the printer-compatible field and preserves the breakdown", async () => {
  const response = await send({
    expected_promotion: { id: offer.id, total_cents: 4500 },
  });
  expect(response.status).toBe(200);
  expect(saved()[2]).toBe(5000);
  expect(saved()[3]).toBe(800);
  expect(saved()[4]).toBe(4500);
  expect(saved()[15]).toBe(1300);
  expect(JSON.parse(saved()[18])).toMatchObject({
    name: "Especial",
    discount_cents: 1300,
  });
  expect(saved()[2] + saved()[3] - saved()[15]).toBe(saved()[4]);
  expect(writes.some((sql) => sql.includes("stock_quantity"))).toBe(true);
});

it("uses the public origin for PIX webhooks behind the VPS proxy", async () => {
  const previous = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.NEXT_PUBLIC_BASE_URL = "https://www.imenuapp.com.br";
  try {
    expect((await send({ paymentMethod: "pix" })).status).toBe(200);
    expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationUrl: "https://www.imenuapp.com.br/api/webhooks/mercadopago",
      }),
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = previous;
  }
});

it("charges PIX using the final server total", async () => {
  const response = await send({ paymentMethod: "pix" });
  expect(response.status).toBe(200);
  expect(saved()[1]).toBe("pending_online_payment");
  expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 45, externalReference: orderId }),
  );
});

it("accepts an applied everyday delivery promotion with a zero fee and preserves the charged total", async () => {
  offers = [
    {
      ...offer,
      rules: [{ type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] }],
      benefits: [{ type: "delivery" }],
    },
  ];
  const response = await send({
    delivery_fee_cents: 0,
    paymentMethod: "pix",
    expected_promotion: { id: offer.id, total_cents: 5000 },
  });
  expect(response.status).toBe(200);
  expect(saved()[2]).toBe(5000);
  expect(saved()[3]).toBe(0);
  expect(saved()[4]).toBe(5000);
  expect(saved()[15]).toBeNull();
  expect(JSON.parse(saved()[18])).toMatchObject({
    id: offer.id,
    discount_cents: 0,
  });
  expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 50 }),
  );
});

it("does not create a PIX charge for a fully free order", async () => {
  offers = [
    {
      ...offer,
      benefits: [{ type: "percent", value: 100 }, { type: "delivery" }],
    },
  ];
  expect((await send({ paymentMethod: "pix" })).status).toBe(200);
  expect(saved()[4]).toBe(0);
  expect(saved()[1]).toBe("pending_physical_payment");
  expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("handles Mesa independently without delivery, coupon or PIX", async () => {
  const response = await send({
    is_delivery: "mesa",
    table_token: tableId,
    table_id: tableId,
    paymentMethod: null,
    coupon_discount_cents: 1000,
  });
  expect(response.status).toBe(200);
  expect(saved()[3]).toBe(0);
  expect(saved()[4]).toBe(4500);
  expect(saved()[15]).toBe(500);
  expect(saved()[16]).toBe(tableId);
  expect(saved()[17]).toBe("Mesa 1");
  expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("keeps only the winning discount and does not consume the replaced coupon", async () => {
  expect(
    (
      await send({
        coupon_id: tableId,
        coupon_code: "TESTE",
        coupon_discount_cents: 200,
        coupon_type: "fixed",
      })
    ).status,
  ).toBe(200);
  expect(saved()[13]).toBeNull();
  expect(saved()[14]).toBeNull();
  expect(saved()[15]).toBe(1300);
});

it("combines coupon and promotion when explicitly enabled", async () => {
  offers = [{ ...offer, allow_coupon: true }];
  expect(
    (
      await send({
        coupon_id: tableId,
        coupon_code: "TESTE",
        coupon_discount_cents: 200,
        coupon_type: "fixed",
      })
    ).status,
  ).toBe(200);
  expect(saved()[13]).toBe(tableId);
  expect(saved()[15]).toBe(1500);
  expect(saved()[4]).toBe(4300);
  expect(JSON.parse(saved()[18]).discount_cents).toBe(1300);
});

it("rejects a stale promotion before order, stock, coupon or payment writes", async () => {
  offers = [];
  expect(
    (
      await send({
        paymentMethod: "pix",
        expected_promotion: { id: offer.id, total_cents: 4500 },
      })
    ).status,
  ).toBe(409);
  expect(insert).toBeNull();
  expect(writes).toEqual([]);
  expect(transactions).toEqual(["rollback"]);
  expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("rejects insufficient stock as a conflict", async () => {
  stock = 0;
  expect((await send()).status).toBe(409);
  expect(insert).toBeNull();
  expect(transactions).toEqual(["rollback"]);
});

it("retains unpaid PIX compensation and restores stock on provider failure", async () => {
  (createMercadoPagoPixCharge as jest.Mock).mockRejectedValue(
    new Error("provider failed"),
  );
  expect((await send({ paymentMethod: "pix" })).status).toBe(500);
  expect(transactions).toEqual(["commit", "commit"]);
  expect(writes.some((sql) => sql.includes("stock_quantity + $1"))).toBe(true);
  expect(
    writes.some((sql) => sql.includes("'canceled'::public.order_status")),
  ).toBe(true);
});

it("schedules offline pushes only after successful creation", async () => {
  (after as jest.Mock).mockImplementation(() => {
    expect(transactions).toEqual(["commit"]);
  });
  expect((await send()).status).toBe(200);
  expect(after).toHaveBeenCalledTimes(1);
  expect(notifyOrderReady).not.toHaveBeenCalled();
  await (after as jest.Mock).mock.calls[0][0]();
  expect(notifyOrderReady).toHaveBeenCalledWith(orderId);
});

it("failed orders do not schedule pushes", async () => {
  stock = 0;
  await send();
  expect(after).not.toHaveBeenCalled();
});

it("push failures cannot fail an already-created order", async () => {
  (notifyOrderReady as jest.Mock).mockRejectedValueOnce(new Error("push unavailable"));
  expect((await send()).status).toBe(200);
  await expect((after as jest.Mock).mock.calls[0][0]()).resolves.toBeUndefined();
});

it("online PIX waits for payment confirmation before sending a push", async () => {
  expect((await send({ paymentMethod: "pix" })).status).toBe(200);
  expect(after).not.toHaveBeenCalled();
  expect(notifyOrderReady).not.toHaveBeenCalled();
});

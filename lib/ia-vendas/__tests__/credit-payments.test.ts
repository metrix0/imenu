import { reconcileCreditPayment } from "../creditPayments";
import { withTransaction } from "@/lib/database/sql";
import type { MercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";

jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({
  createMercadoPagoPixCharge: jest.fn(),
  getMercadoPagoPixPayment: jest.fn(),
  isMercadoPagoPixFailureStatus: (status: string) =>
    ["rejected","cancelled","canceled","refunded","charged_back","expired"].includes(status),
}));

const id = "c7f1e4a1-1111-4111-8111-122222222222";
const payment: MercadoPagoPixPayment = {
  id: "9888877",
  externalReference: "ia-credits:" + id + ":v1",
  paymentMethodId: "pix",
  amount: 2.5,
  status: "approved",
  paidAt: null,
  feeCents: null,
  qrCodeText: null,
  qrCodeBase64: null,
  qrCodeUrl: null,
};
let credited: string | null;
let revoked: string | null;
let inserts: number;
let deductions: number;
let row: Record<string, unknown>;

beforeEach(() => {
  credited = null;
  revoked = null;
  inserts = 0;
  deductions = 0;
  row = {
    id,
    restaurant_id: "test-restaurant",
    input_tokens: "1000000",
    output_tokens: "60000",
    image_count: 10,
    price_cents: 250,
    provider_payment_id: payment.id,
    credited_at: null,
    revoked_at: null,
  };
  const client = {
    query: jest.fn(async (sql: string, values?: unknown[]) => {
      if (sql.startsWith("SELECT * FROM public.ia_vendas_credit_purchases")) {
        return { rows: [{ ...row, credited_at: credited, revoked_at: revoked }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO public.ia_vendas_credit_balances")) inserts += 1;
      if (sql.includes("UPDATE public.ia_vendas_credit_balances")) deductions += 1;
      if (sql.includes("SET status='approved'")) credited = "2026-11-04T00:00:00Z";
      if (sql.includes("SET status=$2") && values?.[2] === true) revoked = "2026-11-04T00:00:00Z";
      return { rows: [], rowCount: 1 };
    }),
  };
  (withTransaction as jest.Mock).mockImplementation(async (fn) => fn(client));
});

test("approved Pix grants wallet credit exactly once across webhook retries", async () => {
  expect(await reconcileCreditPayment(payment, id)).toBe(true);
  expect(await reconcileCreditPayment(payment, id)).toBe(true);
  expect(inserts).toBe(1);
});

test("a mismatched amount never grants credits", async () => {
  await expect(reconcileCreditPayment({ ...payment, amount: 2.0 }, id))
    .rejects.toThrow("divergente");
  expect(inserts).toBe(0);
});

test("refunded payments subtract credits once and cannot grant again", async () => {
  await reconcileCreditPayment(payment, id);
  await reconcileCreditPayment({ ...payment, status: "refunded" }, id);
  await reconcileCreditPayment({ ...payment, status: "refunded" }, id);
  expect(deductions).toBe(1);
  expect(await reconcileCreditPayment(payment, id)).toBe(false);
  expect(inserts).toBe(1);
});

import { createCreditPurchasePayment, reconcileCreditPayment, refreshPendingCreditPurchases } from "../creditPayments";
import { withTransaction, query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment, findMercadoPagoPixPaymentByReference } from "@/lib/payments/mercadoPagoPix";
import type { MercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";

jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({
  createMercadoPagoPixCharge: jest.fn(),
  getMercadoPagoPixPayment: jest.fn(),
  findMercadoPagoPixPaymentByReference: jest.fn(),
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
let transactionQuery: jest.Mock;

beforeEach(() => {
  (query as jest.Mock).mockReset();
  (getMercadoPagoPixPayment as jest.Mock).mockReset();
  (findMercadoPagoPixPaymentByReference as jest.Mock).mockReset();
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
  transactionQuery = client.query;
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

test("an interrupted provider response can be linked and credited once", async () => {
  row.provider_payment_id = null;
  expect(await reconcileCreditPayment(payment, id)).toBe(true);
  expect(await reconcileCreditPayment(payment, id)).toBe(true);
  expect(inserts).toBe(1);
});

test("missing provider links still reject a mismatched reference before crediting", async () => {
  row.provider_payment_id = null;
  await expect(reconcileCreditPayment({ ...payment, externalReference: 'another-purchase' }, id)).rejects.toThrow('divergente');
  expect(inserts).toBe(0);
});

test("orphaned reservations are released only after a successful empty provider lookup", async () => {
  (query as jest.Mock).mockResolvedValueOnce({ rows: [{ ...row, provider_payment_id: null }] }).mockResolvedValue({ rows: [] });
  (findMercadoPagoPixPaymentByReference as jest.Mock).mockResolvedValue(null);
  await refreshPendingCreditPurchases('test-restaurant');
  expect(findMercadoPagoPixPaymentByReference).toHaveBeenCalledWith(payment.externalReference);
  expect((query as jest.Mock).mock.calls[1][0]).toContain("provider_payment_id IS NULL AND created_at<NOW()-interval '30 minutes'");
});

test("a provider lookup error never releases a pending reservation", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [{ ...row, provider_payment_id: null }] });
  (findMercadoPagoPixPaymentByReference as jest.Mock).mockRejectedValue(new Error('timeout'));
  await refreshPendingCreditPurchases('test-restaurant');
  expect(query).toHaveBeenCalledTimes(1);
});

test("expired provider charges are reconciled so they no longer reserve capacity", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [row] });
  (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ ...payment, status: 'expired' });
  await refreshPendingCreditPurchases('test-restaurant');
  expect(getMercadoPagoPixPayment).toHaveBeenCalledWith({ id: payment.id });
  expect(inserts).toBe(0);
  expect(deductions).toBe(0);
  expect(transactionQuery).toHaveBeenCalledWith(expect.stringContaining("SET status=$2"), [id, "failed", false]);
});

test("confirmed pending charges stay reserved and refresh their lookup timestamp", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [row] });
  (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ ...payment, status: "pending" });
  await refreshPendingCreditPurchases("test-restaurant");
  expect(transactionQuery).toHaveBeenCalledWith("UPDATE public.ia_vendas_credit_purchases SET updated_at=NOW() WHERE id=$1", [id]);
  expect(inserts).toBe(0);
  expect(deductions).toBe(0);
});

const checkout = {
  restaurantId: "test-restaurant", requestId: id,
  inputTokens: 1_000_000, images: 10, priceCents: 250,
  payerEmail: null, payerName: null, origin: "https://example.com",
};

test("an approved checkout retry returns the purchase ID used for reconciliation", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [{ ...row, status: "approved", credited_at: "2026-11-04T00:00:00Z" }] });
  expect(await createCreditPurchasePayment(checkout)).toMatchObject({ active: true, transactionId: id });
  expect(getMercadoPagoPixPayment).not.toHaveBeenCalled();
});

test("a closed checkout cannot restart a released reservation with an old request ID", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [{ ...row, status: "failed" }] });
  await expect(createCreditPurchasePayment(checkout)).rejects.toThrow("cobrança foi encerrada");
  expect(getMercadoPagoPixPayment).not.toHaveBeenCalled();
});

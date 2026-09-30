import { POST } from "./route";
import { query } from "@/lib/database/sql";
import { createMercadoPagoPixCharge, getMercadoPagoPixPayment } from "@/lib/mercadoPagoPix";
import { getPayZuPixCharge } from "@/lib/payzu";
import { asaasRequest } from "@/lib/qr-table/asaas";
import { setMercadoPagoQrTablePending } from "@/lib/qr-table/mercadoPagoBilling";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn(async () => ({
        user: { email: "owner@example.com" },
        restaurant: { name: "Restaurant" },
    })),
    RestaurantOwnerAuthError: class extends Error {},
}));
jest.mock("@/lib/payments/types", () => ({ getCreditCardPaymentDataError: jest.fn() }));
jest.mock("@/lib/mercadoPagoPix", () => ({ createMercadoPagoPixCharge: jest.fn(), getMercadoPagoPixPayment: jest.fn(), isMercadoPagoPixFailureStatus: () => false, MercadoPagoPixApiError: class extends Error {} }));
jest.mock("@/lib/payzu", () => ({ getPayZuPixCharge: jest.fn(), PayZuApiError: class extends Error {} }));
jest.mock("@/lib/qr-table/asaas", () => ({ asaasRequest: jest.fn(), AsaasApiError: class extends Error {} }));
jest.mock("@/lib/qr-table/payzuBilling", () => ({ QR_TABLE_PRICE_CENTS: 500, savePayZuQrTablePayment: jest.fn(), activatePayZuQrTablePrepaid: jest.fn() }));
jest.mock("@/lib/qr-table/mercadoPagoBilling", () => ({ setMercadoPagoQrTablePending: jest.fn(), saveMercadoPagoQrTablePayment: jest.fn(), activateMercadoPagoQrTablePrepaid: jest.fn() }));
const addonId = "10000000-0000-4000-8000-000000000001";
const initial = { id: addonId, status: "pending", payment_provider: null, payzu_payment_method: null };
const send = (body = {}) => POST(new Request("https://example.com/api/qr-table/checkout", { method: "POST", body: JSON.stringify({ restaurantId: "restaurant", paymentMethod: "pix", ...body }) }));
beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [initial] });
    (createMercadoPagoPixCharge as jest.Mock).mockImplementation(async input => ({ id: "123", status: "pending", amount: 5, paymentMethodId: "pix", externalReference: input.externalReference, qrCodeText: "pix-payload", qrCodeBase64: "image" }));
});
it("creates new Pix with Mercado Pago and preserves the checkout response fields", async () => {
    const response = await send();
    expect(await response.json()).toMatchObject({ active: false, transactionId: "123", qrCodeText: "pix-payload", qrCodeBase64: "image" });
    expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(expect.objectContaining({
        amount: 5,
        notificationUrl: "https://example.com/api/webhooks/mercadopago",
        payerEmail: "owner@example.com",
        payerName: "Restaurant",
    }));
    expect(getPayZuPixCharge).not.toHaveBeenCalled();
    expect(setMercadoPagoQrTablePending).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "123" }));
});
it("uses a stable creation key when a request is repeated before its payment ID is saved", async () => {
    await send(); await send();
    const calls = (createMercadoPagoPixCharge as jest.Mock).mock.calls;
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
});
it("keeps an existing unpaid PayZu charge usable", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ ...initial, payment_provider: "payzu", payzu_payment_method: "PIX", payzu_payment_id: "PIX1" }] });
    (getPayZuPixCharge as jest.Mock).mockResolvedValue({ id: "PIX1", status: "PENDING", qrCodeText: "old-payload" });
    expect(await (await send()).json()).toMatchObject({ transactionId: "PIX1", qrCodeText: "old-payload" });
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});
it("renews a legacy prepaid addon without a PayZu ID using Mercado Pago", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ ...initial, status: "active", payment_provider: "payzu", payzu_payment_method: "PIX", payzu_payment_id: null }] });
    expect((await send({ renew: true })).status).toBe(200);
    expect(setMercadoPagoQrTablePending).toHaveBeenCalledWith(expect.objectContaining({ preserveAccess: true }));
});
it("reuses the current Mercado Pago charge", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ ...initial, payment_provider: "mercadopago", mercadopago_order_id: "123" }] });
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ id: "123", status: "pending", amount: 5, paymentMethodId: "pix", externalReference: `qr-table:${addonId}:cycle` });
    expect((await send()).status).toBe(200);
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});
it("keeps recurring card billing on Asaas", async () => {
    (asaasRequest as jest.Mock).mockResolvedValue({ data: [{ id: "sub1" }] });
    expect(await (await send({ paymentMethod: "credit_card", card: {} })).json()).toMatchObject({ recurring: true, transactionId: "sub1" });
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

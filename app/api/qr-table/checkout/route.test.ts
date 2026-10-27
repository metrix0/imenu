import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { POST } from "./route";
import { POST as iaPlusCheckout } from "@/app/api/ia-plus/checkout/route";
import { query } from "@/lib/database/sql";
import { createMercadoPagoPixCharge, getMercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";
import { getPayZuPixCharge } from "@/lib/payments/payzu";
import { asaasRequest } from "@/lib/qr-table/asaas";
import { setMercadoPagoQrTablePending } from "@/lib/qr-table/mercadoPagoBilling";

jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn(async () => ({
        user: { email: "owner@example.com" },
        restaurant: { name: "Restaurant" },
    })),
    RestaurantOwnerAuthError: class extends Error {},
}));
jest.mock("@/lib/payments/types", () => ({ getCreditCardPaymentDataError: jest.fn() }));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ createMercadoPagoPixCharge: jest.fn(), getMercadoPagoPixPayment: jest.fn(), isMercadoPagoPixFailureStatus: () => false, MercadoPagoPixApiError: class extends Error {} }));
jest.mock("@/lib/payments/payzu", () => ({ getPayZuPixCharge: jest.fn(), PayZuApiError: class extends Error {} }));
jest.mock("@/lib/qr-table/asaas", () => ({ asaasRequest: jest.fn(), AsaasApiError: class extends Error {} }));
jest.mock("@/lib/qr-table/payzuBilling", () => ({ QR_TABLE_PRICE_CENTS: 500, savePayZuQrTablePayment: jest.fn(), activatePayZuQrTablePrepaid: jest.fn() }));
jest.mock("@/lib/qr-table/mercadoPagoBilling", () => ({ setMercadoPagoQrTablePending: jest.fn(), saveMercadoPagoQrTablePayment: jest.fn(), activateMercadoPagoQrTablePrepaid: jest.fn() }));
const addonId = "10000000-0000-4000-8000-000000000001";
const initial = { id: addonId, status: "pending", payment_provider: null, payzu_payment_method: null };
const send = (body = {}) => POST(new Request("https://example.com/api/qr-table/checkout", { method: "POST", body: JSON.stringify({ restaurantId: "restaurant", paymentMethod: "pix", ...body }) }));
beforeEach(() => {
    jest.clearAllMocks();
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
    (query as jest.Mock).mockResolvedValue({ rows: [initial] });
    (createMercadoPagoPixCharge as jest.Mock).mockImplementation(async input => ({ id: "123", status: "pending", amount: 5, paymentMethodId: "pix", externalReference: input.externalReference, qrCodeText: "pix-payload", qrCodeBase64: "image" }));
});

it.each([false,true])("QR checkout always rejects new payment, renew=%s", async (renew) => {
    const response = await send({ renew });
    expect(response.status).toBe(410);
    expect((await response.json()).error).toContain("gratuito");
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
    expect(asaasRequest).not.toHaveBeenCalled();
});

it("iMenu Plus checkout uses its server price and an isolated addon/payment reference", async () => {
    (createMercadoPagoPixCharge as jest.Mock).mockImplementation(async input => ({ id: "plus-payment", status: "pending", amount: input.amount, paymentMethodId: "pix", externalReference: input.externalReference, qrCodeText: "pix-plus" }));
    const response = await iaPlusCheckout(new Request("https://example.com/api/ia-plus/checkout", { method: "POST", body: JSON.stringify({ restaurantId: "restaurant", paymentMethod: "pix", priceCents: 500, productKey: "qr_code_mesa" }) }));
    expect(response.status).toBe(200);
    expect((query as jest.Mock).mock.calls[0][1]).toEqual(["restaurant", 4999, "mesas", "ia_plus"]);
    expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 49.99, externalReference: expect.stringMatching(/^ia-plus:/) }));
});

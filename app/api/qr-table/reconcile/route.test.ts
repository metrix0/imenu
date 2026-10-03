import { POST } from "./route";
import { query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/mercadoPagoPix";
import { markMercadoPagoQrTablePaymentFailure } from "@/lib/qr-table/mercadoPagoBilling";

jest.mock("@/lib/auth/restaurantOwner", () => ({
    getAuthenticatedUser: jest.fn(),
    requireRestaurantOwner: jest.fn(),
    RestaurantOwnerAuthError: class extends Error {
        status = 401;
    },
}));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/mercadoPagoPix", () => ({
    getMercadoPagoPixPayment: jest.fn(),
    isMercadoPagoPixFailureStatus: jest.fn(() => true),
    MercadoPagoPixApiError: class extends Error {
        status = 500;
    },
}));
jest.mock("@/lib/payzu", () => ({
    getPayZuPixCharge: jest.fn(),
    PayZuApiError: class extends Error {
        status = 500;
    },
}));
jest.mock("@/lib/qr-table/asaas", () => ({
    asaasRequest: jest.fn(),
    AsaasApiError: class extends Error {
        status = 500;
    },
}));
jest.mock("@/lib/qr-table/payzuBilling", () => ({
    QR_TABLE_PRICE_CENTS: 500,
    activatePayZuQrTablePrepaid: jest.fn(),
    markPayZuQrTablePaymentFailure: jest.fn(),
    savePayZuQrTablePayment: jest.fn(),
}));
jest.mock("@/lib/qr-table/mercadoPagoBilling", () => ({
    activateMercadoPagoQrTablePrepaid: jest.fn(),
    markMercadoPagoQrTablePaymentFailure: jest.fn(),
    saveMercadoPagoQrTablePayment: jest.fn(),
}));

const addonId = "10000000-0000-4000-8000-000000000001";
const addon = {
    id: addonId,
    restaurant_id: "restaurant",
    status: "canceled",
    payment_provider: "mercadopago",
    mercadopago_order_id: "123",
    mercadopago_order_status: "APPROVED",
    current_period_ends_at: "2099-01-01T00:00:00.000Z",
};

function send() {
    return POST(
        new Request("https://example.com/api/qr-table/reconcile", {
            method: "POST",
            body: JSON.stringify({ restaurantId: "restaurant" }),
        })
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [addon] })
        .mockResolvedValueOnce({
            rows: [{ ...addon, status: "past_due" }],
        });
});

it.each(["refunded", "cancelled", "canceled", "charged_back"])(
    "expires prepaid access when Mercado Pago reports %s during manual reconciliation",
    async (status) => {
        (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({
            id: "123",
            status,
            amount: 5,
            externalReference: `qr-table:${addonId}:cycle`,
            paymentMethodId: "pix",
            paidAt: null,
        });

        expect((await send()).status).toBe(200);
        expect(markMercadoPagoQrTablePaymentFailure).toHaveBeenCalledWith(
            expect.objectContaining({
                addonId,
                paymentId: "123",
                status,
                expireAccess: true,
            })
        );
    }
);

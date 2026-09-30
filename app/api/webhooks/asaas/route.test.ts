import { POST } from "./route";
import { query } from "@/lib/database/sql";
import { asaasRequest } from "@/lib/qr-table/asaas";
import { resolveAsaasSubscriptionId } from "@/lib/qr-table/asaasSubscription";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/qr-table/asaas", () => ({
    asaasRequest: jest.fn(),
}));
jest.mock("@/lib/qr-table/asaasSubscription", () => ({
    resolveAsaasSubscriptionId: jest.fn(),
}));

const addonId = "10000000-0000-4000-8000-000000000001";
const originalToken = process.env.ASAAS_WEBHOOK_TOKEN;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "test-token";
});

afterAll(() => {
    if (originalToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
    else process.env.ASAAS_WEBHOOK_TOKEN = originalToken;
});

it("ignores stale Asaas events for a Mercado Pago-owned QR Mesa addon", async () => {
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ event_id: "evt-1" }] })
        .mockResolvedValueOnce({
            rows: [{ id: addonId, payment_provider: "mercadopago" }],
        })
        .mockResolvedValueOnce({ rows: [] });

    const response = await POST(
        new Request("https://example.com/api/webhooks/asaas", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "asaas-access-token": "test-token",
            },
            body: JSON.stringify({
                id: "evt-1",
                event: "PAYMENT_CONFIRMED",
                payment: {
                    id: "pay-1",
                    externalReference: addonId,
                    status: "CONFIRMED",
                    value: 5,
                },
            }),
        })
    );

    expect(response.status).toBe(200);
    expect(asaasRequest).not.toHaveBeenCalled();
    expect(resolveAsaasSubscriptionId).not.toHaveBeenCalled();

    const sql = (query as jest.Mock).mock.calls
        .map((call) => String(call[0]))
        .join("\n");
    expect(sql).not.toContain("status = 'active'");
    expect(sql).not.toContain("INSERT INTO public.restaurant_addon_payments");
});

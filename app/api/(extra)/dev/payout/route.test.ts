import { POST } from "./route";
import { createClient } from "@supabase/supabase-js";
import {
    createPayoutPlan,
    getAsaasBalance,
} from "@/lib/services/payouts";
import {
    assertMercadoPagoPayoutConfigured,
    transferMercadoPagoToAsaas,
} from "@/lib/services/mercadoPagoPayout";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/payouts", () => ({
    createPayoutPlan: jest.fn(),
    getAsaasBalance: jest.fn(),
    getPayoutDashboardData: jest.fn(),
    retryFailedPayout: jest.fn(),
    sendPayouts: jest.fn(),
    PayoutValidationError: class extends Error {},
}));
jest.mock("@/lib/services/mercadoPagoPayout", () => ({
    assertMercadoPagoPayoutConfigured: jest.fn(),
    transferMercadoPagoToAsaas: jest.fn(),
}));

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function request() {
    return POST(
        new Request("https://example.com/api/dev/payout", {
            method: "POST",
            headers: {
                authorization: "Bearer token",
                "content-type": "application/json",
            },
            body: JSON.stringify({ action: "fund_asaas" }),
        })
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    (createClient as jest.Mock).mockReturnValue({
        auth: {
            getUser: jest.fn(async () => ({
                data: { user: { email: "joaovralmeida@hotmail.com" } },
                error: null,
            })),
        },
    });
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        totalNetCents: 10_000,
        sendable: [
            {
                row: {
                    payments: [
                        { id: "order-b" },
                        { id: "order-a" },
                    ],
                },
            },
        ],
    });
    (getAsaasBalance as jest.Mock).mockResolvedValue(2_500);
    (transferMercadoPagoToAsaas as jest.Mock).mockResolvedValue({
        transactionStatus: "processed",
    });
});

afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
});

it("funds only the current Asaas shortfall through Mercado Pago", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
        success: true,
        skipped: false,
        amountCents: 7_500,
        requiredCents: 10_000,
        asaasBalanceBeforeCents: 2_500,
    });
    expect(assertMercadoPagoPayoutConfigured).toHaveBeenCalledTimes(1);
    expect(transferMercadoPagoToAsaas).toHaveBeenCalledWith(
        expect.objectContaining({
            amountCents: 7_500,
            clientReference: expect.stringMatching(
                /^imenu-mp-manual-[0-9a-f]{16}-7500$/
            ),
        })
    );
});

it("does not create a payout when Asaas already covers the pending repasses", async () => {
    (getAsaasBalance as jest.Mock).mockResolvedValue(10_000);

    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
        success: true,
        skipped: true,
        amountCents: 0,
    });
    expect(assertMercadoPagoPayoutConfigured).not.toHaveBeenCalled();
    expect(transferMercadoPagoToAsaas).not.toHaveBeenCalled();
});

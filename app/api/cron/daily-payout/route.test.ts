import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { sendNtfyNotification } from "@/lib/services/ntfy";
import { alarmUnnotifiedPayoutFailures, notifyPayoutProblem } from "@/lib/services/payoutNotifications";
import { createPayoutPlan, getAsaasBalance, sendPayouts } from "@/lib/services/payouts";
import { transferMercadoPagoToAsaas } from "@/lib/services/mercadoPagoPayout";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/ntfy", () => ({ sendNtfyNotification: jest.fn() }));
jest.mock("@/lib/services/payoutNotifications", () => ({
    notifyPayoutProblem: jest.fn(),
    alarmUnnotifiedPayoutFailures: jest.fn(),
}));
jest.mock("@/lib/services/payouts", () => ({
    createPayoutPlan: jest.fn(),
    failRecentPendingPayouts: jest.fn(async () => []),
    getAsaasBalance: jest.fn(),
    getPayoutCutoffAt: jest.fn(() => new Date("2026-11-08T13:00:00.000Z")),
    PayoutValidationError: class extends Error {},
    reconcileProcessingPayouts: jest.fn(),
    sendPayouts: jest.fn(),
}));
jest.mock("@/lib/services/mercadoPagoPayout", () => ({
    transferMercadoPagoToAsaas: jest.fn(),
    isMercadoPagoPayoutComplete: jest.fn(),
    reconcileMercadoPagoFunding: jest.fn(),
    assertMercadoPagoPayoutConfigured: jest.fn(),
    MercadoPagoPayoutError: class extends Error {},
}));

const cutoff = "2026-11-08T13:00:00.000Z";
const missing = {
    restaurant_id: "missing",
    restaurant_name: "Kiosque da praça",
    payment_info: "",
    payment_info_type: "EVP",
    gross_cents: 9070,
    pix_order_count: 1,
    provider_fee_cents: 54,
};
const valid = {
    restaurant_id: "valid",
    restaurant_name: "Loja com PIX",
    payment_info: "valid@example.com",
    payment_info_type: "EMAIL",
    gross_cents: 10000,
    pix_order_count: 1,
    provider_fee_cents: 100,
};

function request() {
    return new Request("https://example.com/api/cron/daily-payout", {
        headers: { authorization: "Bearer test-secret" },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.PAYOUT_CRON_ENABLED = "true";
    process.env.NTFY_TOPIC = "test-topic";
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("INSERT INTO public.payout_automation_runs")) {
            return { rows: [{ id: "run-1" }] };
        }
        if (sql.includes("INSERT INTO public.payouts")) {
            return { rows: [{ id: "missing-payout" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
    });
    (getAsaasBalance as jest.Mock).mockResolvedValue(100000);
    (transferMercadoPagoToAsaas as jest.Mock).mockResolvedValue(null);
    (sendPayouts as jest.Mock).mockResolvedValue({
        paidCount: 1, processingCount: 0, failedCount: 0,
        validationErrors: [], results: [{ restaurantId: "valid", restaurantName: "Loja com PIX", amountCents: 9900, status: "paid" }],
    });
});

afterAll(() => {
    delete process.env.CRON_SECRET;
    delete process.env.PAYOUT_CRON_ENABLED;
    delete process.env.NTFY_TOPIC;
});

test("records missing PIX as a failed, retryable payout and checks unnotified failures even when none can be sent", async () => {
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        payables: [missing], sendable: [], validationErrors: [],
        grossCents: 0, payzuFeeCents: 0, discountCents: 0, totalNetCents: 0,
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
        success: false, blocked: false, failedCount: 1,
        error: expect.stringContaining("PIX pendente"),
    });
    const record = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("INSERT INTO public.payouts")
    );
    expect(record?.[0]).toContain("ON CONFLICT (automation_run_id, restaurant_id)");
    expect(record?.[0]).toContain("'failed'");
    expect(record?.[1]).toEqual(["missing", 8979, 9070, 54, 37, cutoff, 1, "run-1", "Chave PIX não cadastrada."]);
    expect(notifyPayoutProblem).toHaveBeenCalledWith("missing", "missing-key");
    expect(alarmUnnotifiedPayoutFailures).toHaveBeenCalledTimes(1);
    expect(alarmUnnotifiedPayoutFailures).toHaveBeenCalledWith(["missing-payout"]);
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        trigger: "none", title: "iMenu: repasse automático não concluído",
    }));
    expect(sendPayouts).not.toHaveBeenCalled();
    expect(transferMercadoPagoToAsaas).not.toHaveBeenCalled();
});

test("counts a missing PIX type alongside successful transfers without funding it", async () => {
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        payables: [{ ...missing, payment_info: "untyped@example.com", payment_info_type: null }, valid],
        sendable: [{ row: valid, grossCents: 10000, payzuFeeCents: 100, discountCents: 0, netCents: 9900, orderCount: 1 }],
        validationErrors: [], grossCents: 10000, payzuFeeCents: 100,
        discountCents: 0, totalNetCents: 9900,
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({
        success: false, failedCount: 1, paidCount: 1,
        skippedRestaurantCount: 0,
        results: expect.arrayContaining([expect.objectContaining({
            restaurantId: "missing", amountCents: 8979, status: "failed", message: "Tipo de PIX não cadastrado.",
        })]),
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.payouts"),
        ["missing", 8979, 9070, 54, 37, cutoff, 1, "run-1", "Tipo de PIX não cadastrado."]);
    expect(notifyPayoutProblem).toHaveBeenCalledWith("missing", "missing-type");
    expect(sendPayouts).toHaveBeenCalledWith(expect.objectContaining({
        automationRunId: "run-1", expectedTotalCents: 9900,
    }));
    expect(alarmUnnotifiedPayoutFailures).toHaveBeenCalledTimes(1);
    expect(alarmUnnotifiedPayoutFailures).toHaveBeenCalledWith(["missing-payout"]);
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        trigger: "none", title: "iMenu: repasse automático não concluído",
    }));
});

test("alarms immediately when an intended payout is skipped", async () => {
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        payables: [valid], sendable: [], validationErrors: [],
        grossCents: 0, payzuFeeCents: 0, discountCents: 0, totalNetCents: 0,
    });

    const response = await GET(request());

    expect(await response.json()).toMatchObject({ blocked: true, success: false });
    expect(sendNtfyNotification).toHaveBeenCalledTimes(1);
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        trigger: "alarm", incidentKey: "payout:unnotified:run-1",
        title: "ALARM TRIGGER - iMenu: repasse automático bloqueado",
    }));
});

test("records an empty payout day without raising an alarm", async () => {
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        payables: [], sendable: [], validationErrors: [],
        grossCents: 0, payzuFeeCents: 0, discountCents: 0, totalNetCents: 0,
    });

    await GET(request());

    expect(sendNtfyNotification).toHaveBeenCalledTimes(1);
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({ trigger: "none" }));
});

test("alarms for overdue payouts with orders even on a day with no new payouts", async () => {
    const originalQuery = (query as jest.Mock).getMockImplementation()!;
    (query as jest.Mock).mockImplementation(async (sql: string, values: unknown[]) => {
        if (sql.includes("COUNT(*) OVER ()")) {
            return { rows: [{
                restaurant_name: "Melkis Monte Mor", amount_cents: 11978, payout_date: "15/11/2026", total: 1,
            }] };
        }
        return originalQuery(sql, values);
    });
    (createPayoutPlan as jest.Mock).mockResolvedValue({
        payables: [], sendable: [], validationErrors: [],
        grossCents: 0, payzuFeeCents: 0, discountCents: 0, totalNetCents: 0,
    });

    await GET(request());

    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        trigger: "alarm",
        incidentKey: "payout:overdue:run-1",
        message: expect.stringContaining("15/11/2026 · Melkis Monte Mor"),
    }));
    expect(notifyPayoutProblem).not.toHaveBeenCalled();
    expect(sendPayouts).not.toHaveBeenCalled();
});

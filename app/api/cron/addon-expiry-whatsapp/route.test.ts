import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { sendWahaText } from "@/lib/services/wahaClient";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({ sendWahaText: jest.fn() }));

const makeRequest = (authorized = true) =>
    new Request("https://example.com/api/cron/addon-expiry-whatsapp", {
        headers: authorized ? { authorization: "Bearer cron-test-secret" } : {},
    });
const baseRow = {
    restaurant_id: "restaurant-1",
    product_key: "ia_plus",
    owner_phone: "11912345678",
    restaurant_phone: null,
};

function mockDatabase(rows: Array<typeof baseRow & { reminder_kind: "pix" | "card" }>, claimed = true) {
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("support_whatsapp_connection")) {
            return { rows: [{ session_name: "support-session" }], rowCount: 1 };
        }
        if (sql.includes("FROM public.restaurant_addons ra")) {
            return { rows, rowCount: rows.length };
        }
        if (sql.includes("INSERT INTO public.whatsapp_outbound_messages")) {
            return { rows: claimed ? [{ dedupe_key: "claim" }] : [], rowCount: claimed ? 1 : 0 };
        }
        return { rows: [], rowCount: 1 };
    });
}

beforeEach(() => {
    jest.resetAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
    (sendWahaText as jest.Mock).mockResolvedValue({});
});

afterAll(() => {
    delete process.env.CRON_SECRET;
});

it("rejects unauthenticated requests without accessing subscriptions", async () => {
    expect((await GET(makeRequest(false))).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
});

it("selects day-30 Pix reminders and day-29 canceled paid-card reminders", async () => {
    mockDatabase([]);
    expect((await GET(makeRequest())).status).toBe(200);
    const sql = (query as jest.Mock).mock.calls.find(([statement]) =>
        String(statement).includes("FROM public.restaurant_addons ra")
    )?.[0] as string;
    expect(sql).toContain("(NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 1");
    expect(sql).toContain("ra.payment_provider = 'mercadopago'");
    expect(sql).toContain("ra.payzu_recurrence_id IS NULL");
    expect(sql).toContain("ra.payment_provider = 'asaas'");
    expect(sql).toContain("ra.status = 'canceled'");
    expect(sql).toContain("ra.asaas_subscription_id IS NOT NULL");
    expect(sql).toContain("payment.billing_type");
    expect(sql).toContain("payment.paid_at IS NOT NULL");
    expect(sql).toContain("plus.product_key = 'ia_plus'");
    expect(sendWahaText).not.toHaveBeenCalled();
});

it("groups Pix and canceled-card notices into one correct WhatsApp message", async () => {
    mockDatabase([
        { ...baseRow, reminder_kind: "pix" },
        { ...baseRow, product_key: "qr_code_mesa", reminder_kind: "card" },
    ]);
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
        restaurants: 1, sent: 1, failed: 0,
    }));
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    const [session, chat, message] = (sendWahaText as jest.Mock).mock.calls[0];
    expect(session).toBe("support-session");
    expect(chat).toBe("5511912345678@c.us");
    expect(message).toContain("iMenu Plus");
    expect(message).toContain("QR Code Mesa");
    expect(message).toContain("1 dia de tolerância");
    expect(message).toContain("assinatura do seu adicional");
    expect(message).toContain("vence amanhã");
});

it("keeps the existing per-restaurant daily deduplication", async () => {
    mockDatabase([{ ...baseRow, reminder_kind: "card" }], false);
    const response = await GET(makeRequest());
    expect(await response.json()).toEqual(expect.objectContaining({
        restaurants: 1, sent: 0, skipped: 1,
    }));
    expect(sendWahaText).not.toHaveBeenCalled();
});

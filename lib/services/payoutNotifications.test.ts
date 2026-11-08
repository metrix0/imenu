import { query } from "@/lib/database/sql";
import { checkWahaPhoneExists, sendWahaText } from "@/lib/services/wahaClient";
import { alarmUnnotifiedPayoutFailures, notifyPayoutProblem, payoutNotice } from "./payoutNotifications";
import { sendNtfyNotification } from "@/lib/services/ntfy";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportBlast", () => ({ normalizeBlastPhone: (phone: string) => phone ? "5511999999999" : null }));
jest.mock("@/lib/services/wahaClient", () => ({ checkWahaPhoneExists: jest.fn(), sendWahaText: jest.fn() }));
jest.mock("@/lib/services/ntfy", () => ({ sendNtfyNotification: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    const claims = new Set<string>();
    (query as jest.Mock).mockImplementation(async (sql: string, values: unknown[]) => {
        if (sql.includes("FROM restaurants r")) return { rows: [{ phone: "11999999999", session_name: "blast", status: "WORKING", desired_state: "connected", day: "2026-11-04" }], rowCount: 1 };
        if (sql.startsWith("INSERT")) {
            const key = String(values[0]);
            if (claims.has(key)) return { rows: [], rowCount: 0 };
            claims.add(key); return { rows: [{ dedupe_key: key }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
    });
    (checkWahaPhoneExists as jest.Mock).mockResolvedValue({ numberExists: true, chatId: "5511999999999@c.us" });
    (sendWahaText as jest.Mock).mockResolvedValue(undefined);
});

test("concurrent missing-key and failure notices share one daily atomic claim", async () => {
    await Promise.all([notifyPayoutProblem("restaurant", true), notifyPayoutProblem("restaurant", false)]);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(dedupe_key) DO NOTHING"), expect.arrayContaining(["support:payout:2026-11-04:restaurant"]));
});

test("a failed/uncertain WhatsApp attempt is not sent again the same day", async () => {
    (sendWahaText as jest.Mock).mockRejectedValue(new Error("timeout"));
    await expect(notifyPayoutProblem("restaurant", false)).resolves.toBeUndefined();
    await notifyPayoutProblem("restaurant", false);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='failed'"), expect.arrayContaining(["timeout"]));
});

test("different restaurants have independent daily claims", async () => {
    await notifyPayoutProblem("one", true); await notifyPayoutProblem("two", true);
    expect(sendWahaText).toHaveBeenCalledTimes(2);
});

test("messages require the owner to edit Loja for safety and contain no actual PIX data", () => {
    for (const missing of [true, false]) {
        expect(payoutNotice(missing)).toContain("aba Loja");
        expect(payoutNotice(missing)).toContain("Por segurança");
        expect(payoutNotice(missing)).toContain("somente você");
    }
});

test('does not alarm when there are no failed payouts lacking a confirmed notice', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await alarmUnnotifiedPayoutFailures();
    expect(sendNtfyNotification).not.toHaveBeenCalled();
});

test('alarms once per failed batch when the automatic restaurant notice was not confirmed', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [
        { id: 'p1', automation_run_id: 'run1', restaurant_name: 'CN Burger', amount_cents: 198, failure_reason: 'Falha Asaas', notice_status: null },
        { id: 'p2', automation_run_id: 'run1', restaurant_name: 'Restaurante 2', amount_cents: 500, failure_reason: null, notice_status: 'failed' },
    ] });
    await alarmUnnotifiedPayoutFailures();
    expect(sendNtfyNotification).toHaveBeenCalledTimes(1);
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        trigger: 'alarm',
        incidentKey: 'payout:unnotified:run1',
        message: expect.stringContaining('CN Burger: R$ 1.98'),
    }));
    const sql = (query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain("p.status IN ('failed','cancelled')");
    expect(sql).toContain("notice.status IS DISTINCT FROM 'sent'");
    expect(sql).toContain("notice.status IS DISTINCT FROM 'sending'");
    expect((query as jest.Mock).mock.calls[0][1]).toEqual([payoutNotice(false)]);
});

test('does not block reconciliation when phone alarm delivery fails', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [
        { id: 'p3', automation_run_id: null, restaurant_name: 'R', amount_cents: 99, failure_reason: null, notice_status: 'failed' },
    ] });
    (sendNtfyNotification as jest.Mock).mockRejectedValueOnce(new Error('ntfy down'));
    await expect(alarmUnnotifiedPayoutFailures()).resolves.toBeUndefined();
    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({ incidentKey: 'payout:unnotified:p3' }));
});

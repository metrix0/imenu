import { query } from "@/lib/database/sql";
import { checkWahaPhoneExists, sendWahaText } from "@/lib/services/wahaClient";
import { notifyPayoutProblem, payoutNotice } from "./payoutNotifications";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportBlast", () => ({ normalizeBlastPhone: (phone: string) => phone ? "5511999999999" : null }));
jest.mock("@/lib/services/wahaClient", () => ({ checkWahaPhoneExists: jest.fn(), sendWahaText: jest.fn() }));

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

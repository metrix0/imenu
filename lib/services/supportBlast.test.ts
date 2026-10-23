import { processSupportBlastQueue } from "./supportBlast";
import { query } from "@/lib/database/sql";
import { checkWahaPhoneExists, sendWahaText } from "@/lib/services/wahaClient";
import { SINGLE_ORDER_DAY_RECOVERY_MESSAGE } from "@/lib/dev/abandonedBlast";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({
    sendWahaText: jest.fn(),
    checkWahaPhoneExists: jest.fn(),
    isWahaHttpErrorStatus: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

test("dispatch checks a 60-day history, including sends before the policy change", async () => {
    let claimCount = 0;
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("WITH claimed AS")) {
            claimCount++;
            if (claimCount > 1) return { rows: [], rowCount: 0 };
            return { rows: [{
                id: 7,
                campaign_id: "c7eaa724-463e-48fb-a51d-e6cbe5cd6841",
                phone: "5511999999999",
                message: "Mensagem de recuperação",
                sender: "blast",
                skip_recent: true,
                campaign_message: SINGLE_ORDER_DAY_RECOVERY_MESSAGE,
            }], rowCount: 1 };
        }
        if (sql.includes("FROM support_whatsapp_connection")) {
            return { rows: [{ session_name: "imenu-blast", status: "WORKING", desired_state: "connected" }], rowCount: 1 };
        }
        if (sql.includes("FROM support_blast_campaigns WHERE id")) {
            return { rows: [{ id: "c7eaa724-463e-48fb-a51d-e6cbe5cd6841" }], rowCount: 1 };
        }
        if (sql.includes("SELECT DISTINCT r.id AS restaurant_id")) {
            return { rows: [{ restaurant_id: "48d60032-7c4f-4d4c-8a0f-9d5ea2a0d754", account_id: "account-1" }], rowCount: 1 };
        }
        if (sql.includes("GROUP BY o.restaurant_id")) {
            return { rows: [{ eligible: 1 }], rowCount: 1 };
        }
        if (sql.includes("SELECT 1 FROM whatsapp_outbound_messages")) {
            // Simulates one prior outreach 45 days ago.
            const matches60Days = sql.split("THEN INTERVAL '60 days' ELSE INTERVAL '7 days' END").length === 3;
            return { rows: matches60Days ? [{ found: 1 }] : [], rowCount: matches60Days ? 1 : 0 };
        }
        return { rows: [], rowCount: 1 };
    });

    const outcome = await processSupportBlastQueue();
    expect(outcome).toEqual({ sent: 0, failed: 0, skipped: 1, disconnected: false });
    expect(sendWahaText).not.toHaveBeenCalled();
    const skipCall = (query as jest.Mock).mock.calls.find(([sql, params]) =>
        String(sql).includes("UPDATE support_blast_recipients SET status = $2") &&
        params?.[0] === 7
    );
    expect(skipCall?.[1]).toEqual([7, "skipped_60d", null]);
});

test("paces up to three sends 3–5 seconds apart in one worker run", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-23T23:00:00.000Z"));
    jest.spyOn(Math, "random").mockReturnValue(0); // Minimum 3-second pause.
    const sendTimes: number[] = [];
    let claims = 0;
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("WITH claimed AS")) {
            claims++;
            return { rows: [{
                id: claims, campaign_id: "campaign", phone: "5511999999999",
                message: "Mensagem", sender: "blast", skip_recent: false,
                campaign_message: "Mensagem",
            }], rowCount: 1 };
        }
        if (sql.includes("FROM support_whatsapp_connection")) {
            return { rows: [{ session_name: "imenu-blast", status: "WORKING", desired_state: "connected" }], rowCount: 1 };
        }
        if (sql.includes("FROM support_blast_campaigns WHERE id")) return { rows: [{ id: "campaign" }], rowCount: 1 };
        if (sql.includes("SELECT DISTINCT r.id AS restaurant_id")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT 1 FROM support_blast_recipients WHERE id")) return { rows: [{ id: claims }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
    (checkWahaPhoneExists as jest.Mock).mockResolvedValue({ numberExists: true, chatId: "5511999999999@c.us" });
    (sendWahaText as jest.Mock).mockImplementation(async () => { sendTimes.push(Date.now()); });
    const start = Date.now();
    try {
        const run = processSupportBlastQueue();
        await jest.advanceTimersByTimeAsync(10_000);
        const result = await run;
        expect(result).toEqual({ sent: 3, failed: 0, skipped: 0, disconnected: false });
        expect(sendTimes).toEqual([start, start + 3_000, start + 6_000]);
        expect(claims).toBe(3);
    } finally {
        jest.useRealTimers();
        jest.restoreAllMocks();
    }
});

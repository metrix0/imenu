import { isSupportContactExcluded } from "@/lib/services/supportExclusions";
import { createSupportBlast, processSupportBlastQueue } from "./supportBlast";
import { query, withTransaction } from "@/lib/database/sql";
import { checkWahaPhoneExists, sendWahaImage, sendWahaText } from "@/lib/services/wahaClient";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { SINGLE_ORDER_DAY_RECOVERY_MESSAGE } from "@/lib/dev/abandonedBlast";

jest.mock("@/lib/services/supportExclusions", () => ({ isSupportContactExcluded: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
beforeEach(() => (isSupportContactExcluded as jest.Mock).mockResolvedValue(false));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({
    sendWahaText: jest.fn(),
    sendWahaImage: jest.fn(),
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

test("image blast sends once with caption and uses a signed private URL", async () => {
    let claims = 0;
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("WITH claimed AS")) {
            if (++claims > 1) return { rows: [], rowCount: 0 };
            return { rows: [{
                id: 15, campaign_id: "campaign-15", phone: "5511999999999",
                message: "Oi, Maria!", sender: "blast", skip_recent: false,
                campaign_message: "Oi, {{Nome}}!",
                campaign_image_path: "campaigns/campaign-15.jpg",
            }], rowCount: 1 };
        }
        if (sql.includes("FROM support_whatsapp_connection")) {
            return { rows: [{ session_name: "imenu-blast", status: "WORKING", desired_state: "connected" }], rowCount: 1 };
        }
        if (sql.includes("FROM support_blast_campaigns WHERE id")) return { rows: [{ id: "campaign-15" }], rowCount: 1 };
        if (sql.includes("SELECT DISTINCT r.id AS restaurant_id")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT 1 FROM support_blast_recipients WHERE id")) return { rows: [{ id: 15 }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
    (checkWahaPhoneExists as jest.Mock).mockResolvedValue({ numberExists: true, chatId: "5511999999999@c.us" });
    const createSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed-photo" }, error: null,
    });
    (createSupabaseServerClient as jest.Mock).mockReturnValue({
        storage: { from: jest.fn().mockReturnValue({ createSignedUrl }) },
    });

    const result = await processSupportBlastQueue();
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0, disconnected: false });
    expect(sendWahaImage).toHaveBeenCalledTimes(1);
    expect(sendWahaImage).toHaveBeenCalledWith(
        "imenu-blast", "5511999999999@c.us", "https://storage.example.com/signed-photo", "Oi, Maria!"
    );
    expect(sendWahaText).not.toHaveBeenCalled();
    expect(createSignedUrl).toHaveBeenCalledWith("campaigns/campaign-15.jpg", 120);
    const outboundClaim = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("INSERT INTO whatsapp_outbound_messages")
    );
    expect(outboundClaim?.[1]?.[3]).toBe("image");
});

test("recovery ignores stale and out-of-hours campaigns even when daily_limit is NULL", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await processSupportBlastQueue();
    const expiry = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("Campanha de recuperação expirada.")
    );
    expect(expiry).toBeDefined();
    expect(expiry![0]).toContain("c.sender = 'blast'");
    expect(expiry![0]).toContain("c.message = ANY($1::text[])");
    expect(expiry![0]).toContain("r.status = 'pending'");
    expect(expiry![0]).toContain("c.created_at AT TIME ZONE 'America/Sao_Paulo'");
    const claim = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("WITH claimed AS")
    );
    expect(claim).toBeDefined();
    expect(claim![0]).toContain("c.sender <> 'blast' OR c.message <> ALL($1::text[])");
    expect(claim![0]).toContain("TIME '08:00'");
    expect(claim![0]).toContain("TIME '21:00'");
    expect(claim![0]).toContain("c.daily_limit IS NULL");
    expect(claim![1][1]).toBe(13);
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0, disconnected: false });
    expect(sendWahaText).not.toHaveBeenCalled();
});

test("automatic recovery always uses the shared 13/day cadence even when a caller provides 5", async () => {
    const write = jest.fn().mockResolvedValue({ rowCount: 1 });
    (withTransaction as jest.Mock).mockImplementation(async (fn) => fn({ query: write }));
    (query as jest.Mock).mockResolvedValue({
        rows: [{ desired_state: "connected", status: "WORKING" }],
    });
    const id = "ba0d64cc-1928-4690-93a5-3cd96af89e02";
    await createSupportBlast({
        sender: "blast", message: SINGLE_ORDER_DAY_RECOVERY_MESSAGE,
        dailyLimit: 5, skipRecent: true, campaignId: id,
        recipients: [{ phone: "5511999999999", message: "Oi, Loja!" }],
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][1][3]).toBe(13);
    expect(write.mock.calls[1][1][2]).toBe(13);
});

test("manual support blast cadence remains unchanged", async () => {
    const write = jest.fn().mockResolvedValue({ rowCount: 1 });
    (withTransaction as jest.Mock).mockImplementation(async (fn) => fn({ query: write }));
    (query as jest.Mock).mockResolvedValue({
        rows: [{ desired_state: "connected", status: "WORKING" }],
    });
    await createSupportBlast({
        sender: "support", message: "Aviso personalizado",
        dailyLimit: 5, skipRecent: true,
        recipients: [{ phone: "5511999999999", message: "Aviso personalizado" }],
    });
    expect(write.mock.calls[0][1][3]).toBe(5);
    expect(write.mock.calls[1][1][2]).toBe(5);
});

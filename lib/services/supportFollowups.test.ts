import { processSupportFollowups } from "./supportFollowups";
import { query, withAdvisoryLock } from "@/lib/database/sql";
import { generateSupportFollowup, SUPPORT_FOLLOWUP_OFFER } from "@/lib/services/supportAgent";
import { isSupportConversationBlacklisted } from "@/lib/services/supportWhatsApp";
import { sendWahaText } from "@/lib/services/wahaClient";

jest.mock("@/lib/database/sql", () => ({
    query: jest.fn(),
    withAdvisoryLock: jest.fn(async (_key, fn) => fn()),
}));
jest.mock("@/lib/services/supportAgent", () => ({
    generateSupportFollowup: jest.fn(),
    SUPPORT_FOLLOWUP_OFFER: "Caso queira, posso redirecionar você para nossa equipe de suporte técnico! 😊",
}));
jest.mock("@/lib/services/supportWhatsApp", () => ({
    isSupportConversationBlacklisted: jest.fn(),
}));
jest.mock("@/lib/services/wahaClient", () => ({
    SUPPORT_WAHA_SESSION_NAME: "imenu-support",
    sendWahaText: jest.fn(),
}));

const candidate = {
    id: "a3a69782-7690-47c9-9b45-b942d6b60c44",
    chat_id: "5511999990000@c.us",
    followup_anchor_inbound_at: "2026-10-23T10:00:00.000Z",
    followup_last_ai_at: "2026-10-23T10:00:10.000Z",
};

beforeEach(() => {
    jest.clearAllMocks();
    (isSupportConversationBlacklisted as jest.Mock).mockResolvedValue(false);
    (generateSupportFollowup as jest.Mock).mockResolvedValue("Tudo certo com o teste?\n\n" + SUPPORT_FOLLOWUP_OFFER);
    (sendWahaText as jest.Mock).mockResolvedValue({ id: "delivered" });
});

test("only unresolved AI replies older than an hour, in business hours, are eligible", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await processSupportFollowups()).toBe(0);
    const [sql] = (query as jest.Mock).mock.calls[0];
    expect(sql).toContain("followup_state = 'awaiting_customer'");
    expect(sql).toContain("followup_attempted_at IS NULL");
    expect(sql).toContain("INTERVAL '1 hour'");
    expect(sql).toContain("conn.bot_enabled");
    expect(sql).toContain("c.handoff_prompted_at IS NULL");
    expect(sql).toContain("America/Sao_Paulo");
    expect(generateSupportFollowup).not.toHaveBeenCalled();
});

test("reserves the single follow-up atomically and records its delivery", async () => {
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT c.id, c.chat_id")) return { rows: [candidate], rowCount: 1 };
        if (sql.includes("SET followup_attempted_at = NOW()")) return { rows: [{ id: candidate.id }], rowCount: 1 };
        if (sql.includes("INSERT INTO support_messages")) return { rows: [{ id: "followup-1" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
    expect(await processSupportFollowups()).toBe(1);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    expect(sendWahaText).toHaveBeenCalledWith("imenu-support", candidate.chat_id,
        expect.stringContaining(SUPPORT_FOLLOWUP_OFFER));
    expect(withAdvisoryLock).toHaveBeenCalledWith("support-reply:" + candidate.chat_id, expect.any(Function));
    const claim = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("SET followup_attempted_at = NOW()"));
    expect(claim?.[0]).toContain("c.last_inbound_at = $3::timestamptz");
    expect(claim?.[0]).toContain("c.last_outbound_at = $4::timestamptz");
    expect(claim?.[0]).toContain("c.mode = 'ai'");
});

test("no follow-up is sent when a reply or another worker invalidates the claim", async () => {
    (query as jest.Mock).mockImplementation(async (sql: string) =>
        sql.includes("SELECT c.id, c.chat_id")
            ? { rows: [candidate], rowCount: 1 }
            : { rows: [], rowCount: 0 });
    expect(await processSupportFollowups()).toBe(0);
    expect(sendWahaText).not.toHaveBeenCalled();
});

test("WAHA timeout does not cause a second send attempt", async () => {
    (sendWahaText as jest.Mock).mockRejectedValue(new Error("timeout"));
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT c.id, c.chat_id")) return { rows: [candidate], rowCount: 1 };
        if (sql.includes("SET followup_attempted_at = NOW()")) return { rows: [{ id: candidate.id }], rowCount: 1 };
        if (sql.includes("INSERT INTO support_messages")) return { rows: [{ id: "followup-1" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
    expect(await processSupportFollowups()).toBe(0);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    expect((query as jest.Mock).mock.calls.some(([sql]) =>
        String(sql).includes("SET send_status = 'failed'"))).toBe(true);
});

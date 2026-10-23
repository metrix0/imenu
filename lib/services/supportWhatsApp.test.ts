import { query } from "@/lib/database/sql";
import { resolveWahaChatPhone } from "@/lib/services/wahaClient";
import { isSecondaryBlastRecipient } from "./supportWhatsApp";

jest.mock("@/lib/database/sql", () => ({
    query: jest.fn(),
    withAdvisoryLock: jest.fn(),
}));
jest.mock("@/lib/services/supportAgent", () => ({
    analyzeSupportImage: jest.fn(),
    generateSupportReply: jest.fn(),
    classifySupportFollowup: jest.fn(),
    transcribeSupportAudio: jest.fn(),
}));
jest.mock("@/lib/services/wahaClient", () => ({
    resolveWahaChatPhone: jest.fn(),
    SUPPORT_WAHA_SESSION_NAME: "imenu-support",
}));

beforeEach(() => {
    jest.clearAllMocks();
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5511999999999");
});

test("secondary WhatsApp accepts sent 20:00 recovery blasts and ordinary blasts", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "5511999999999@s.whatsapp.net",
    })).resolves.toBe(true);

    const [sql, params] = (query as jest.Mock).mock.calls[0];
    expect(sql).toContain("status = 'sent'");
    expect(sql).toContain("dedupe_key LIKE 'support:bulk:blast:%'");
    expect(sql).toContain("dedupe_key LIKE 'support:bulk:abandoned:%'");
    expect(sql).not.toContain("dedupe_key LIKE 'support:bulk:%'");
    expect(params).toHaveLength(1);
    expect(params[0]).toContain("5511999999999@c.us");
});

test("secondary WhatsApp rejects a contact without any qualifying sent blast", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "5511999999999@c.us",
    })).resolves.toBe(false);
});

test("secondary WhatsApp recognizes a recipient from a resolved LID", async () => {
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5511999999999");
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "123456789@lid",
    })).resolves.toBe(true);

    const [, params] = (query as jest.Mock).mock.calls[0];
    expect(params[0]).toContain("5511999999999@c.us");
});

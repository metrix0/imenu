import OpenAI from "openai";
import { query } from "@/lib/database/sql";
import { classifySupportFollowup, generateSupportFollowup, SUPPORT_FOLLOWUP_OFFER } from "./supportAgent";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportMcp", () => ({
    createSupportMcpToken: jest.fn(),
    searchSupportKnowledge: jest.fn(),
}));

jest.mock("openai", () => ({
    __esModule: true,
    default: jest.fn(),
    toFile: jest.fn(),
}));

const create = jest.fn();
beforeEach(() => {
    jest.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-only";
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
        responses: { create },
    }) as unknown as OpenAI);
    (query as jest.Mock).mockResolvedValue({
        rows: [
            { direction: "inbound", body: "Não consigo configurar a impressão.", model: null },
            { direction: "outbound", body: "Pode me dizer qual impressora usa?", model: "gpt" },
        ],
    });
});

afterAll(() => { delete process.env.OPENAI_API_KEY; });

test("classifies unanswered technical questions separately from resolved support conversations", async () => {
    create.mockResolvedValue({ status: "completed", output_text: "awaiting_customer" });
    await expect(classifySupportFollowup("conversation-1")).resolves.toBe("awaiting_customer");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].instructions).toContain("awaiting_support");
});

test("unknown classification fails closed", async () => {
    create.mockResolvedValue({ status: "incomplete", output_text: "" });
    await expect(classifySupportFollowup("conversation-1")).resolves.toBe("resolved");
});

test("the contextual follow-up always appends the exact support-team offer", async () => {
    create.mockResolvedValue({ status: "completed", output_text: "Conseguiu encontrar o modelo da impressora?" });
    const followup = await generateSupportFollowup("conversation-1");
    expect(followup).toBe("Conseguiu encontrar o modelo da impressora?\n\n" + SUPPORT_FOLLOWUP_OFFER);
    expect(followup.endsWith(SUPPORT_FOLLOWUP_OFFER)).toBe(true);
});

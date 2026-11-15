import OpenAI from "openai";
import { query } from "@/lib/database/sql";
import { searchSupportKnowledge } from "./supportMcp";
import { analyzeSupportImage, classifySupportFollowup, generateSupportFollowup, generateSupportReply, SUPPORT_FOLLOWUP_OFFER } from "./supportAgent";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportMcp", () => ({
    createSupportMcpToken: jest.fn(),
    SUPPORT_MENU_LINK_TOOL: "get_restaurant_menu_link",
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
    jest.replaceProperty(process, "env", {
        ...process.env,
        OPENAI_API_KEY: "test-only",
        OPENAI_SUPPORT_MODEL: "gpt-5.6-luna",
        IMENU_SUPPORT_PUBLIC_URL: "https://support.example.com",
    });
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

afterEach(() => { jest.restoreAllMocks(); });

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

test("support chat caches its fixed rules and still receives current knowledge and history", async () => {
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ direction: "inbound", body: "Como configuro a impressora?" }] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] });
    (searchSupportKnowledge as jest.Mock).mockResolvedValue([{ id: "1", title: "Impressão", content: "Abra as configurações." }]);
    create.mockResolvedValue({ status: "completed", output_text: "Abra as configurações." });

    await generateSupportReply("conversation-1");

    const request = create.mock.calls[0][0];
    expect(request.prompt_cache_options).toEqual({ mode: "explicit" });
    const [rules, knowledge] = request.input[0].content;
    expect(rules.prompt_cache_breakpoint).toEqual({ mode: "explicit" });
    expect(rules.text).not.toContain("Abra as configurações.");
    expect(knowledge.text).toContain("Abra as configurações.");
    expect(knowledge.prompt_cache_breakpoint).toBeUndefined();
    expect(request.input[1]).toEqual({ role: "user", content: "Como configuro a impressora?" });
});

test.each([
    ["gpt-5.6-luna", { mode: "explicit" }],
    ["gpt-4o-mini", undefined],
])("support image requests avoid writes for one-off images on %s", async (model, cacheOptions) => {
    process.env.OPENAI_SUPPORT_MODEL = model;
    create.mockResolvedValue({ status: "completed", output_text: "Imagem analisada." });

    await expect(analyzeSupportImage(Buffer.from("image"), "image/png", "Minha legenda"))
        .resolves.toBe("Imagem analisada.");

    const request = create.mock.calls[0][0];
    expect(request.prompt_cache_options).toEqual(cacheOptions);
    expect(request.input[0].content.map((part: { type: string }) => part.type)).toEqual(["input_text", "input_image"]);
    expect(request.input[0].content.some((part: object) => "prompt_cache_breakpoint" in part)).toBe(false);
});

function mockMenuReply(outputText: string, toolOutput?: unknown) {
    const conversation = { mode: "ai", handoff_prompted_at: null };
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ direction: "inbound", body: "Qual o link do meu cardápio?" }] })
        .mockResolvedValueOnce({ rows: [conversation] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [conversation] });
    (searchSupportKnowledge as jest.Mock).mockResolvedValue([]);
    create.mockResolvedValue({
        status: "completed", output_text: outputText,
        output: toolOutput === undefined ? [] : [{
            type: "mcp_call", server_label: "imenu_support", name: "get_restaurant_menu_link",
            output: JSON.stringify(toolOutput),
        }],
    });
}

test("never sends the invented imenu.com.br menu URL", async () => {
    mockMenuReply("Seu link é: https://imenu.com.br/c-m-lanches");
    const reply = await generateSupportReply("conversation-1");
    expect(reply.text).toBe("Não consegui confirmar o link do cardápio. Qual é o nome da loja?");
});

test.each([
    "Seu link é: [[MENU_URL]]",
    "Seu link é: https://imenu.com.br/c-m-lanches",
    "Seu link é: https://www.imenuapp.com.br/outra-loja",
    "Seu link é: https://inventado.example/c-m-lanches",
])("inserts only the verified menu URL for %s", async (draft) => {
    mockMenuReply(draft, { menu_url: "https://www.imenuapp.com.br/c-m-lanches" });
    const reply = await generateSupportReply("conversation-1");
    expect(reply.text).toBe("Seu link é: https://www.imenuapp.com.br/c-m-lanches");
});

test("reports an unverified menu link when the lookup has no URL", async () => {
    mockMenuReply("Seu link é: https://www.imenuapp.com.br/outra-loja", { menu_url: null });
    const reply = await generateSupportReply("conversation-1");
    expect(reply.text).toBe("Não consegui confirmar o link do cardápio.");
});

test("preserves links to the iMenu dashboard and the restaurant's WhatsApp", async () => {
    const message = "Abra https://www.imenuapp.com.br/painel ou fale com a loja em https://wa.me/5511900000000.";
    mockMenuReply(message);
    await expect(generateSupportReply("conversation-1")).resolves.toMatchObject({ text: message });
});


test("offers human support after answering an affiliate question", async () => {
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ direction: "inbound", body: "Quanto ganha um afiliado?" }] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] });
    (searchSupportKnowledge as jest.Mock).mockResolvedValue([]);
    create.mockResolvedValue({ status: "completed", output_text: "A comissão é de 50%." });

    const reply = await generateSupportReply("conversation-1");

    expect(reply.text).toBe("A comissão é de 50%. Quer que eu encaminhe para nossa equipe de suporte?");
    expect(reply.handoffState).toBeNull();
});

test("preserves paragraphs and list items in support replies with WhatsApp formatting", async () => {
    mockMenuReply("Para conferir:\r\n\r\n- Abra **Repasses**.  \r\n- Confira o histórico.\r\n\r\nO valor a receber é uma previsão.");
    const reply = await generateSupportReply("conversation-1");
    expect(reply.text).toBe("Para conferir:\n\n- Abra *Repasses*.\n- Confira o histórico.\n\nO valor a receber é uma previsão.");
});

test("keeps the support offer out of the last list item", async () => {
    mockMenuReply("Não consegui confirmar o status.\n\n- Veja o histórico.\n- Confira o valor.");
    const reply = await generateSupportReply("conversation-1");
    expect(reply.text).toBe("Não consegui confirmar o status.\n\n- Veja o histórico.\n- Confira o valor.\n\nQuer que eu encaminhe para nossa equipe de suporte?");
});

test("preserves line breaks in contextual follow-up messages", async () => {
    create.mockResolvedValue({ status: "completed", output_text: "Conseguiu continuar?\r\n\r\nPosso ajudar por aqui." });
    await expect(generateSupportFollowup("conversation-1"))
        .resolves.toBe("Conseguiu continuar?\n\nPosso ajudar por aqui.\n\n" + SUPPORT_FOLLOWUP_OFFER);
});

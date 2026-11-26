import OpenAI, { toFile } from "openai";
import { query } from "@/lib/database/sql";
import { searchSupportKnowledge } from "./supportMcp";
import { transcribeSupportAudio, analyzeSupportImage, classifySupportFollowup, generateSupportFollowup, generateSupportReply, SUPPORT_FOLLOWUP_OFFER } from "./supportAgent";

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
        OPENAI_SUPPORT_MODEL: "gpt-6-luna",
        OPENAI_SUPPORT_FOLLOWUP_MODEL: "",
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
    expect(create.mock.calls[0][0]).toMatchObject({ model: "gpt-6-luna", reasoning: { effort: "none" } });
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
        .mockResolvedValueOnce({ rows: [{ should_review_loop: false }] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] });
    (searchSupportKnowledge as jest.Mock).mockResolvedValue([{ id: "1", title: "Impressão", content: "Abra as configurações." }]);
    create.mockResolvedValue({ status: "completed", output_text: "Abra as configurações." });

    await generateSupportReply("conversation-1");

    const request = create.mock.calls[0][0];
    expect(create).toHaveBeenCalledTimes(1);
    expect(request.max_output_tokens).toBe(800);
    expect(request.include).toEqual(["reasoning.encrypted_content"]);
    expect(request.prompt_cache_options).toEqual({ mode: "explicit" });
    const [rules, knowledge] = request.input[0].content;
    expect(rules.prompt_cache_breakpoint).toEqual({ mode: "explicit" });
    expect(rules.text).not.toContain("Abra as configurações.");
    expect(knowledge.text).toContain("Abra as configurações.");
    expect(knowledge.prompt_cache_breakpoint).toBeUndefined();
    expect(request.input[1]).toEqual({ role: "user", content: "Como configuro a impressora?" });
});

test.each([
    ["gpt-6-luna", { mode: "explicit" }],
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
        .mockResolvedValueOnce({ rows: [{ should_review_loop: false }] })
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

test("resumes only a token-exhausted reply with 2200 more tokens and preserves tool results", async () => {
    mockMenuReply("");
    create.mockReset();
    const reasoning = { type: "reasoning", id: "rs-test", summary: [], encrypted_content: "encrypted", status: "incomplete" };
    const toolResult = {
        type: "mcp_call", server_label: "imenu_support", name: "get_restaurant_menu_link",
        output: JSON.stringify({ menu_url: "https://www.imenuapp.com.br/c-m-lanches" }),
        status: "completed",
    };
    create
        .mockResolvedValueOnce({
            status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
            output: [reasoning, toolResult], output_text: "",
            usage: { input_tokens: 100, output_tokens: 800 },
        })
        .mockResolvedValueOnce({
            status: "completed", output_text: "Seu link é: [[MENU_URL]]", output: [],
            usage: { input_tokens: 150, output_tokens: 220 },
        });

    const reply = await generateSupportReply("conversation-1");

    expect(create).toHaveBeenCalledTimes(2);
    const [first, resumed] = create.mock.calls.map(([request]) => request);
    expect(first.max_output_tokens).toBe(800);
    expect(resumed.max_output_tokens).toBe(2200);
    expect(resumed.store).toBe(false);
    expect(resumed.input.slice(0, first.input.length)).toEqual(first.input);
    expect(resumed.input).toContainEqual(reasoning);
    expect(resumed.input).toContainEqual(toolResult);
    expect(reply.text).toBe("Seu link é: https://www.imenuapp.com.br/c-m-lanches");
    expect(reply.inputTokens).toBe(250);
    expect(reply.outputTokens).toBe(1020);
});

test("does not repeat a failed 2200-token continuation", async () => {
    mockMenuReply("");
    create.mockReset();
    create.mockResolvedValue({
        status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
        output: [], output_text: "",
    });

    await expect(generateSupportReply("conversation-1")).rejects.toMatchObject({
        code: "SUPPORT_AI_CONTINUATION_EXHAUSTED",
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([request]) => request.max_output_tokens)).toEqual([800, 2200]);
});

test("does not continue when a response fails for another reason", async () => {
    mockMenuReply("");
    create.mockReset();
    create.mockResolvedValue({ status: "incomplete", incomplete_details: { reason: "content_filter" } });

    await expect(generateSupportReply("conversation-1")).rejects.toThrow("content_filter");
    expect(create).toHaveBeenCalledTimes(1);
});

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
        .mockResolvedValueOnce({ rows: [{ should_review_loop: false }] })
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

test.each([
    [true, "NO_REPLY", true],
    [true, "Claro, vou te ajudar com isso.", false],
    [false, "Claro, vou te ajudar com isso.", false],
])("loop review=%s, model output=%s: skipReply=%s", async (review, outputText, skipReply) => {
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ direction: "inbound", body: "Preciso de ajuda com o iMenu." }] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null, blocked_handoff: false, blacklisted: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ should_review_loop: review }] })
        .mockResolvedValueOnce({ rows: [{ mode: "ai", handoff_prompted_at: null }] });
    (searchSupportKnowledge as jest.Mock).mockResolvedValue([]);
    create.mockResolvedValue({ status: "completed", output_text: outputText });

    const result = await generateSupportReply("conversation-1");

    expect(result.skipReply).toBe(skipReply);
    expect(result.text).toBe(skipReply ? "" : outputText);
    const request = create.mock.calls[0][0];
    expect(JSON.stringify(request.input).includes("Verificação de possível loop automatizado")).toBe(review);

    const activityQuery = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("AS should_review_loop"));
    expect(activityQuery?.[1]).toEqual(["conversation-1"]);
    expect(activityQuery?.[0]).toContain("LAG(created_at, 9)");
    expect(activityQuery?.[0]).toContain("INTERVAL '2 minutes'");
    expect(activityQuery?.[0]).toContain("INTERVAL '15 minutes'");
    expect(activityQuery?.[0]).toContain("INTERVAL '17 minutes'");
});


test("support audio uses the dedicated transcription model and key", async () => {
    process.env.OPENAI_SUPPORT_AUDIO_API_KEY = "audio-test-key";
    const transcribe = jest.fn().mockResolvedValue({ text: "Olá, tudo bem?" });
    (toFile as jest.Mock).mockResolvedValue("audio-file");
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({ audio: { transcriptions: { create: transcribe } } }) as unknown as OpenAI);
    await expect(transcribeSupportAudio(Buffer.from("audio"), "audio/mpeg", "audio.mp3")).resolves.toBe("Olá, tudo bem?");
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "audio-test-key" }));
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-4o-mini-transcribe" }), expect.anything());
});

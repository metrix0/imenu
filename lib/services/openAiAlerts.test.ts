import { classifyOpenAiLimit, notifyOpenAiLimit, openAiAlertFetch, notifyOpenAiBatchLimit } from "./openAiAlerts";
import { sendNtfyNotification } from "./ntfy";

jest.mock("./ntfy", () => ({ sendNtfyNotification: jest.fn().mockResolvedValue(undefined) }));

test.each([
    [{ error: { code: "insufficient_quota", message: "You exceeded your current quota" } }, "credits"],
    [{ error: { code: "billing_hard_limit_reached" } }, "credits"],
    [{ code: "context_length_exceeded" }, "tokens"],
    [{ code: "analysis_token_budget_exceeded" }, "analysis_budget"],
    [{ error: { code: "rate_limit_exceeded", message: "Requests per minute" } }, null],
    [{ error: { code: "invalid_api_key" } }, null],
])("classifies only OpenAI credit or token exhaustion", (input, expected) => {
    expect(classifyOpenAiLimit(input)).toBe(expected);
});

test("sends an ALARM TRIGGER for OpenAI quota exhaustion without changing the response", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(new Response(
        JSON.stringify({ error: { code: "insufficient_quota" } }),
        { status: 429, headers: { "Content-Type": "application/json" } },
    ));
    try {
        const response = await openAiAlertFetch("Robô WhatsApp")("https://api.openai.com/v1/responses");
        expect(response.status).toBe(429);
        expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
            title: expect.stringContaining("ALARM TRIGGER"),
            message: expect.stringContaining("Robô WhatsApp"),
        }));
        await notifyOpenAiLimit({ code: "insufficient_quota" }, "Suporte IA");
        expect(sendNtfyNotification).toHaveBeenCalledTimes(1);
    } finally {
        global.fetch = original;
    }
});

test("detects quota errors inside asynchronous Batch JSONL", async () => {
    await notifyOpenAiBatchLimit(JSON.stringify({
        custom_id: "run:1", error: { code: "insufficient_quota" },
    }), "run:1");
    expect(classifyOpenAiLimit({ code: "insufficient_quota" })).toBe("credits");
});

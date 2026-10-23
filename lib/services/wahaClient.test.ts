import { findWahaSentTextSince } from "./wahaClient";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("WAHA confirmation matches a recent outgoing message with exact text", async () => {
    process.env.WAHA_API_URL = "http://waha.test";
    process.env.WAHA_API_KEY = "test-only";
    const started = Date.now();
    const timestamp = Math.floor(started / 1000);
    const messages = [
        { id: "old", timestamp: timestamp - 120, fromMe: true, body: "Olá! 👋" },
        { id: "incoming", timestamp, fromMe: false, body: "Olá! 👋" },
        { id: "other", timestamp, fromMe: true, body: "Outra mensagem" },
        { id: "confirmed", timestamp: timestamp + 1, fromMe: true, body: "Olá! 👋" },
    ];
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(messages), { status: 200 }));
    await expect(findWahaSentTextSince("session", "123@lid", "Olá! 👋", started))
        .resolves.toEqual(expect.objectContaining({ id: "confirmed" }));
});

test("WAHA confirmation is unknown when no matching outgoing text exists", async () => {
    process.env.WAHA_API_URL = "http://waha.test";
    process.env.WAHA_API_KEY = "test-only";
    const started = Date.now();
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify([
        { id: "inbound", timestamp: Math.floor(started / 1000), fromMe: false, body: "Bem-vindo" }
    ]), { status: 200 }));
    await expect(findWahaSentTextSince("session", "123@lid", "Bem-vindo", started)).resolves.toBeNull();
});

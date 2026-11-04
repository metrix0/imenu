import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";

jest.mock("@/lib/database/supabaseClient", () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "test" } } }) },
  },
}));

const previousFetch = globalThis.fetch;

beforeEach(() => {
  useSalesStore.setState({
    restaurant_id: "test-restaurant",
    conversation_id: "test-conversation",
    messages: [],
    busy: false,
    error: null,
    upgradeRequired: false,
    load: async () => {
      // A declined run creates no persisted user message.
      useSalesStore.setState({ messages: [] });
    },
  });
});

afterAll(() => {
  globalThis.fetch = previousFetch;
});

test("a rejected monthly-limit request returns false and preserves its error after reloading", async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Limite mensal de IA atingido. Limites serão reiniciados em 30/11 às 21:00." }),
  }) as typeof fetch;

  const sent = await useSalesStore.getState().send("Minha pergunta não enviada", [], false);
  expect(sent).toBe(false);
  expect(useSalesStore.getState().error).toContain("Limites serão reiniciados em 30/11 às 21:00");
  expect(useSalesStore.getState().busy).toBe(false);
  expect(useSalesStore.getState().messages).toHaveLength(0);
});

test("an SSE quota rejection is not mistaken for a delivered message", async () => {
  const body = new TextEncoder().encode('event: error\ndata: {"message":"Limite mensal de IA atingido."}\n\n');
  const reader = {
    read: jest.fn().mockResolvedValueOnce({ done: false, value: body }).mockResolvedValueOnce({ done: true }),
  };
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } }) as typeof fetch;

  const sent = await useSalesStore.getState().send("Outra pergunta", [], false);
  expect(sent).toBe(false);
  expect(useSalesStore.getState().error).toBe("Limite mensal de IA atingido.");
});

test("a completed SSE response is marked as delivered", async () => {
  const body = new TextEncoder().encode('event: done\ndata: {"id":"response"}\n\n');
  const reader = {
    read: jest.fn().mockResolvedValueOnce({ done: false, value: body }).mockResolvedValueOnce({ done: true }),
  };
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } }) as typeof fetch;

  const sent = await useSalesStore.getState().send("Pergunta recebida", [], false);
  expect(sent).toBe(true);
  expect(useSalesStore.getState().error).toBeNull();
});

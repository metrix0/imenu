const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
function worker(settings = new Map([["deviceToken", "a".repeat(40)]])) {
    const handlers = {};
    const database = { objectStoreNames: { contains: () => true }, close: jest.fn(), transaction() {
            const transaction = { objectStore: () => ({
                    get(key) { const r = {}; queueMicrotask(() => { r.result = settings.get(key); r.onsuccess?.(); }); return r; },
                    put(value, key) { settings.set(key, value); },
                    openCursor() { const r = {}, entries = [...settings.entries()]; let i = 0; const next = () => queueMicrotask(() => { const e = entries[i++]; r.result = e ? { key: e[0], value: e[1], delete: () => settings.delete(e[0]), continue: next } : null; r.onsuccess?.(); }); next(); return r; }
                }) };
            setImmediate(() => transaction.oncomplete?.());
            return transaction;
        } };
    const fetch = jest.fn(async () => new Response(JSON.stringify({ notifications: [] }))), show = jest.fn(async () => undefined);
    const context = { indexedDB: { open: () => { const r = {}; queueMicrotask(() => { r.result = database; r.onsuccess?.(); }); return r; } }, fetch, AbortSignal, URL, Date, console: { error: jest.fn() }, self: { addEventListener: (n, f) => handlers[n] = f, registration: { showNotification: show }, clients: {}, location: { origin: "https://www.imenuapp.com.br" } } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../../public/sw.js"), "utf8"), context);
    return { show, fetch, settings, push(payload) { let p; handlers.push({ data: payload === undefined ? null : { json: () => payload }, waitUntil: v => p = v }); return p; } };
}
function payload(id = "10000000-0000-4000-8000-000000000001") { return { id, title: "Novo pedido", body: "Cliente", url: "/painel/pedidos", tag: `order-${id}`, created_at: new Date().toISOString(), expiresAt: Date.now() + 300000 }; }
test("encrypted push displays its order before acknowledging without fetching queue", async () => {
    const w = worker(), p = payload();
    await w.push(p);
    expect(w.show).toHaveBeenCalledWith(p.title, expect.objectContaining({ body: p.body, tag: p.tag, renotify: false }));
    expect(w.fetch).toHaveBeenCalledTimes(1);
    expect(w.fetch.mock.calls[0][0]).toBe("/api/push/next");
    expect(w.fetch.mock.calls[0][1].method).toBe("POST");
    expect(w.show.mock.invocationCallOrder[0]).toBeLessThan(w.fetch.mock.invocationCallOrder[0]);
});
test("expired encrypted push does not fetch a different order", async () => { const w = worker(); await w.push({ ...payload(), expiresAt: Date.now() - 1 }); expect(w.show).not.toHaveBeenCalled(); expect(w.fetch).not.toHaveBeenCalled(); });
test("simultaneous retries replace the same alert silently", async () => {
    const w = worker(), p = payload();
    await Promise.all([w.push(p), w.push(p), w.push(p)]);
    expect(w.show).toHaveBeenCalledTimes(3);
    expect(new Set(w.show.mock.calls.map(([, o]) => o.tag)).size).toBe(1);
    expect(w.show.mock.calls[1][1]).toMatchObject({ silent: true, renotify: false });
    expect(w.show.mock.calls[1][1]).not.toHaveProperty("vibrate");
});
test("duplicate protection survives worker restart", async () => { const settings = new Map([["deviceToken", "a".repeat(40)]]), p = payload(); await worker(settings).push(p); const w = worker(settings); await w.push(p); expect(w.show).toHaveBeenCalledWith(p.title, expect.objectContaining({ silent: true, renotify: false, tag: p.tag })); });
test("offline acknowledgement cannot prevent display", async () => { const w = worker(); w.fetch.mockRejectedValue(new Error("offline")); await w.push(payload()); expect(w.show).toHaveBeenCalledTimes(1); });
test("slow acknowledgement cannot block next order", async () => {
    const w = worker();
    let release;
    w.fetch.mockImplementationOnce(() => new Promise(r => release = r));
    const first = w.push(payload());
    await new Promise(setImmediate);
    await new Promise(setImmediate);
    await w.push(payload("20000000-0000-4000-8000-000000000002"));
    expect(w.show).toHaveBeenCalledTimes(2);
    release(new Response("{}"));
    await first;
});
test("failed display neither acknowledges nor remembers shown", async () => {
    const w = worker(), p = payload();
    w.show.mockRejectedValueOnce(new Error("failed"));
    await w.push(p);
    expect(w.fetch).not.toHaveBeenCalled();
    expect(w.settings.has(`shown-${p.id}`)).toBe(false);
    await w.push(p);
    expect(w.show).toHaveBeenCalledTimes(2);
    expect(w.fetch).toHaveBeenCalledTimes(1);
});
test("legacy wake displays all fresh queued orders and excludes stale ones", async () => {
    const w = worker();
    w.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [payload(), payload("20000000-0000-4000-8000-000000000002"), { ...payload("30000000-0000-4000-8000-000000000003"), expiresAt: Date.now() - 1 }] })));
    await w.push();
    expect(w.show).toHaveBeenCalledTimes(2);
    expect(w.fetch.mock.calls[0][0]).toContain("batch=1");
});
test("empty legacy queues do not fabricate generic alerts", async () => { const w = worker(); await w.push(); expect(w.show).not.toHaveBeenCalled(); });
test("missing device token does not prevent encrypted delivery", async () => { const w = worker(new Map()); await w.push(payload()); expect(w.show).toHaveBeenCalledTimes(1); expect(w.fetch).not.toHaveBeenCalled(); });
test("legacy API failure does not fabricate alerts", async () => { const w = worker(); w.fetch.mockResolvedValue(new Response("{}", { status: 500 })); await w.push(); expect(w.show).not.toHaveBeenCalled(); });

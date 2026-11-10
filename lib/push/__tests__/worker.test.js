const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("stale order push notifications", () => {
    async function deliver(payload) {
        const listeners = {};
        const showNotification = jest.fn().mockResolvedValue(undefined);
        const context = vm.createContext({
            console, Date, URL,
            fetch: jest.fn().mockResolvedValue({ ok: true, json: async () => payload }),
            self: {
                addEventListener: (name, callback) => { listeners[name] = callback; },
                registration: { showNotification },
            },
        });
        vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../public/sw.js"), "utf8"), context);
        vm.runInContext('readDeviceToken = async () => "test-device-token-123456";', context);
        let completed;
        listeners.push({ waitUntil: (promise) => { completed = promise; } });
        await completed;
        return showNotification;
    }

    test("a queue containing no fresh order produces no alert", async () => {
        expect(await deliver(null)).not.toHaveBeenCalled();
    });

    test("an alert that expires before display is not shown", async () => {
        expect(await deliver({ title: "Yesterday's order", body: "Old order", expiresAt: Date.now() - 1 }))
            .not.toHaveBeenCalled();
    });

    test("a fresh order is still displayed", async () => {
        const showNotification = await deliver({
            title: "New order", body: "Order #38", url: "/painel/pedidos", expiresAt: Date.now() + 120_000,
        });
        expect(showNotification).toHaveBeenCalledTimes(1);
        expect(showNotification).toHaveBeenCalledWith("New order", expect.objectContaining({ body: "Order #38" }));
    });
});

describe("push display acknowledgment", () => {
    test("acknowledges only after display and deduplicates a retried wake", async () => {
        const listeners = {};
        const events = [];
        const payload = {
            id: "10000000-0000-4000-8000-000000000001",
            title: "Novo pedido", body: "Pedido #10", url: "/painel",
            tag: "order-10", expiresAt: Date.now() + 120_000,
        };
        const showNotification = jest.fn().mockImplementation(async () => {
            events.push("display");
        });
        const fetchMock = jest.fn().mockImplementation(async (url) => {
            if (String(url).includes("/api/push/ack")) {
                events.push("ack");
                return { ok: true };
            }
            return { ok: true, json: async () => payload };
        });
        const context = vm.createContext({
            console, Date, URL,
            fetch: fetchMock,
            self: {
                addEventListener: (name, callback) => { listeners[name] = callback; },
                registration: { showNotification },
            },
            remembered: false,
        });
        vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../public/sw.js"), "utf8"), context);
        vm.runInContext('readDeviceToken = async () => "test-device-token-123456";', context);
        vm.runInContext(`recentlyShown = async (_id, remember) => {
            const seen = remembered;
            if (remember) remembered = true;
            return seen;
        };`, context);

        async function dispatch() {
            let completed;
            listeners.push({ waitUntil: promise => { completed = promise; } });
            await completed;
        }

        await dispatch();
        await dispatch();

        expect(showNotification).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(events).toEqual(["display", "ack", "ack"]);
        const ackRequest = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/push/ack"));
        expect(JSON.parse(ackRequest[1].body)).toEqual({
            deviceToken: "test-device-token-123456",
            notificationId: payload.id,
        });
    });

    test("does not acknowledge when the device fails to display", async () => {
        const listeners = {};
        const payload = {
            id: "10000000-0000-4000-8000-000000000001",
            title: "Pedido", body: "Pedido", expiresAt: Date.now() + 120_000,
        };
        const showNotification = jest.fn().mockRejectedValue(new Error("Notifications unavailable"));
        const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => payload });
        const context = vm.createContext({
            console, Date, URL, fetch: fetchMock,
            self: {
                addEventListener: (name, callback) => { listeners[name] = callback; },
                registration: { showNotification },
            },
        });
        vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../public/sw.js"), "utf8"), context);
        vm.runInContext('readDeviceToken = async () => "test-device-token-123456";', context);
        vm.runInContext("recentlyShown = async () => false;", context);
        let completed;
        listeners.push({ waitUntil: promise => { completed = promise; } });
        await expect(completed).rejects.toThrow("Notifications unavailable");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

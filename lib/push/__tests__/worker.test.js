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

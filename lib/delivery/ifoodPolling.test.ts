import { query } from "@/lib/database/sql";
import { ifoodApi, updateIfood } from "./ifoodConnection";
import { importIfoodOrder } from "./integrations";
import { receiveIfoodStatus } from "./ifoodStatus";
import { emptyDeliveryConfig, type DeliveryConfig } from "./providers";
import { pollIfoodOrders } from "./ifoodPolling";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("./ifoodConnection", () => ({ ifoodApi: jest.fn(), updateIfood: jest.fn() }));
jest.mock("./integrations", () => ({ importIfoodOrder: jest.fn() }));
jest.mock("./ifoodStatus", () => ({ receiveIfoodStatus: jest.fn() }));
let config: DeliveryConfig;
const merchantId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const event = { id: "event", merchantId, orderId, code: "PLC", createdAt: "2026-11-13T12:00:00Z" };
const respond = (value: unknown) => new Response(JSON.stringify(value));
beforeEach(() => {
    jest.resetAllMocks(); config = structuredClone(emptyDeliveryConfig);
    config.ifood = { enabled: true, merchantId, clientId: "", clientSecret: "", connection: { restaurantId: "restaurant", refreshToken: "refresh" } };
    (updateIfood as jest.Mock).mockImplementation(async (_id, callback) => callback(config));
    (query as jest.Mock).mockResolvedValue({ rows: [] });
});
test("polls only the authorized merchant and acknowledges after importing", async () => {
    const steps: string[] = [];
    (ifoodApi as jest.Mock).mockImplementation(async (_id, path) => {
        if (path.endsWith("events:polling")) return respond([event]);
        if (path.includes("/orders/")) return respond({ id: orderId, merchant: { id: merchantId } });
        steps.push("ack"); return new Response(null, { status: 202 });
    });
    (importIfoodOrder as jest.Mock).mockImplementation(async () => { steps.push("import"); });
    await pollIfoodOrders("restaurant");
    expect(steps).toEqual(["import", "ack"]);
    expect(ifoodApi).toHaveBeenCalledWith("restaurant", "/events/v1.0/events:polling", { headers: { "x-polling-merchants": merchantId } });
    expect((ifoodApi as jest.Mock).mock.calls.at(-1)[2].body).toBe(JSON.stringify([{ id: event.id }]));
    await pollIfoodOrders("restaurant");
    expect(ifoodApi).toHaveBeenCalledTimes(3);
});
test("204 with no events is successful and needs no acknowledgment", async () => {
    (ifoodApi as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));
    await pollIfoodOrders("restaurant");
    expect(ifoodApi).toHaveBeenCalledTimes(1);
    expect(config.ifood.connection?.pollingUntil).toBe(0);
});
test("failed imports and following events for that order are not acknowledged", async () => {
    (ifoodApi as jest.Mock).mockResolvedValueOnce(respond([event, { ...event, id: "confirmed", code: "CFM" }]))
        .mockResolvedValueOnce(respond({ id: orderId, merchant: { id: merchantId } }));
    (importIfoodOrder as jest.Mock).mockRejectedValue(new Error("DB unavailable"));
    await expect(pollIfoodOrders("restaurant")).rejects.toThrow();
    expect(ifoodApi).toHaveBeenCalledTimes(2);
    expect(receiveIfoodStatus).not.toHaveBeenCalled();
    expect(config.ifood.connection?.lastError).toContain("reconecte");
});
test("replayed placements do not import twice", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ exists: true }] });
    (ifoodApi as jest.Mock).mockResolvedValueOnce(respond([event])).mockResolvedValueOnce(new Response(null, { status: 202 }));
    await pollIfoodOrders("restaurant");
    expect(importIfoodOrder).not.toHaveBeenCalled(); expect(ifoodApi).toHaveBeenCalledTimes(2);
});
test("foreign merchant events cannot import or be acknowledged", async () => {
    (ifoodApi as jest.Mock).mockResolvedValueOnce(respond([{ ...event, merchantId: "foreign" }]));
    await expect(pollIfoodOrders("restaurant")).rejects.toThrow();
    expect(importIfoodOrder).not.toHaveBeenCalled(); expect(ifoodApi).toHaveBeenCalledTimes(1);
});
test("a lifecycle event cannot be acknowledged before its order was imported", async () => {
    (ifoodApi as jest.Mock).mockResolvedValueOnce(respond([{ ...event, code: "CFM" }]));
    await expect(pollIfoodOrders("restaurant")).rejects.toThrow();
    expect(receiveIfoodStatus).not.toHaveBeenCalled(); expect(ifoodApi).toHaveBeenCalledTimes(1);
});
test("paused, legacy and already leased connections do not poll", async () => {
    config.ifood.enabled = false; await pollIfoodOrders("restaurant");
    config.ifood.enabled = true; config.ifood.connection!.pollingUntil = Date.now() + 60000; await pollIfoodOrders("restaurant");
    delete config.ifood.connection; await pollIfoodOrders("restaurant");
    expect(ifoodApi).not.toHaveBeenCalled();
});

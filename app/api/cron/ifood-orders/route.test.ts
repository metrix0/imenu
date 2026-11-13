import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { pollIfoodOrders } from "@/lib/delivery/ifoodPolling";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/delivery/ifoodPolling", () => ({ pollIfoodOrders: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); process.env.CRON_SECRET = "cron-secret"; });
test("polling cannot be triggered without the server cron secret", async () => {
    const response = await GET(new Request("https://local/api/cron/ifood-orders"));
    expect(response.status).toBe(401); expect(query).not.toHaveBeenCalled(); expect(pollIfoodOrders).not.toHaveBeenCalled();
});
test("one failed restaurant does not stop polling the remaining restaurants", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ restaurant_id: "first" }, { restaurant_id: "second" }] });
    (pollIfoodOrders as jest.Mock).mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValueOnce(undefined);
    const response = await GET(new Request("https://local/api/cron/ifood-orders", { headers: { Authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ checked: 2, failed: 1 });
    expect(pollIfoodOrders).toHaveBeenNthCalledWith(2, "second");
});

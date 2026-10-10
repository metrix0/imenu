import { GET } from "./route";
import { recoverRecentOrderPushes } from "@/lib/push/server";
jest.mock("@/lib/push/server", () => ({ recoverRecentOrderPushes: jest.fn() }));
const previousSecret = process.env.CRON_SECRET;
afterEach(() => { if (previousSecret === undefined)
    delete process.env.CRON_SECRET;
else
    process.env.CRON_SECRET = previousSecret; jest.restoreAllMocks(); });
test("recovery requires the cron secret", async () => { delete process.env.CRON_SECRET; expect((await GET(new Request("https://imenu.test"))).status).toBe(401); process.env.CRON_SECRET = "test-secret"; expect((await GET(new Request("https://imenu.test"))).status).toBe(401); expect(recoverRecentOrderPushes).not.toHaveBeenCalled(); });
test("authenticated cron recovers notifications", async () => { process.env.CRON_SECRET = "test-secret"; (recoverRecentOrderPushes as jest.Mock).mockResolvedValue({ attempted: 2, failed: 0 }); const r = await GET(new Request("https://imenu.test", { headers: { authorization: "Bearer test-secret" } })); expect(r.status).toBe(200); expect(await r.json()).toEqual({ attempted: 2, failed: 0 }); });
test("database failures are reported for later retry", async () => { process.env.CRON_SECRET = "test-secret"; jest.spyOn(console, "error").mockImplementation(() => undefined); (recoverRecentOrderPushes as jest.Mock).mockRejectedValue(new Error("offline")); expect((await GET(new Request("https://imenu.test", { headers: { authorization: "Bearer test-secret" } }))).status).toBe(500); });

import { POST } from "./route";
import { query } from "@/lib/database/sql";
import { sendNtfyNotification } from "@/lib/services/ntfy";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/ntfy", () => ({ sendNtfyNotification: jest.fn() }));

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    (query as jest.Mock).mockResolvedValue({ rowCount: 1 });
});

afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
});

function notify(message: string, source = "vps-monitor") {
    return POST(new Request("https://example.com/api/notify", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
        body: JSON.stringify({
            source,
            title: "TRIGGER ALARM · iMenu: critical alert",
            message,
        }),
    }));
}

test("acknowledges the delayed daily payout alarm without sending another phone alert", async () => {
    const response = await notify("TRIGGER ALARM\ncron_failed:daily-payout (1)\noperation:payout_failed_today (1)");

    expect(response.status).toBe(200);
    expect(sendNtfyNotification).not.toHaveBeenCalled();
});

test("keeps other alarms from the same monitor notification", async () => {
    await notify("TRIGGER ALARM\ncron_failed:daily-payout (1)\ncron_failed:reconcile-payouts (1)");

    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({
        message: "TRIGGER ALARM\ncron_failed:reconcile-payouts (1)",
    }));
});

test("keeps alerts from other sources", async () => {
    const message = "cron_failed:daily-payout (1)";
    await notify(message, "another-source");

    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({ message }));
});

test("keeps the monitor alarm when the payout job did not record an outcome", async () => {
    (query as jest.Mock).mockResolvedValue({ rowCount: 0 });
    const message = "TRIGGER ALARM\ncron_failed:daily-payout (1)";

    await notify(message);

    expect(sendNtfyNotification).toHaveBeenCalledWith(expect.objectContaining({ message }));
});

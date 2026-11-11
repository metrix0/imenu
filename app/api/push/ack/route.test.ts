import { NextRequest } from "next/server";

import { acknowledgeOwnerPush } from "@/lib/push/server";
import { POST } from "./route";

jest.mock("@/lib/push/server", () => ({ acknowledgeOwnerPush: jest.fn() }));

const deviceToken = "a".repeat(40);
const notificationId = "50000000-0000-4000-8000-000000000001";

function request(host: string, origin?: string): NextRequest {
    return new NextRequest("http://imenu-production-app:3000/api/push/ack", {
        method: "POST",
        headers: {
            Host: host,
            ...(origin ? { Origin: origin } : {}),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceToken, notificationId }),
    });
}

beforeEach(() => {
    (acknowledgeOwnerPush as jest.Mock).mockReset();
    (acknowledgeOwnerPush as jest.Mock).mockResolvedValue(true);
});

test.each([
    ["www.imenuapp.com.br", "https://www.imenuapp.com.br"],
    ["preview.imenuapp.com.br", "https://preview.imenuapp.com.br"],
    ["localhost:3000", "http://localhost:3000"],
])("accepts the public origin %s behind an internal reverse-proxy URL", async (host, origin) => {
    const response = await POST(request(host, origin));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(acknowledgeOwnerPush).toHaveBeenCalledWith(deviceToken, notificationId);
});

test.each([
    ["www.imenuapp.com.br", "https://attacker.example"],
    ["www.imenuapp.com.br", "http://www.imenuapp.com.br"],
    ["preview.imenuapp.com.br", "https://www.imenuapp.com.br"],
    ["www.imenuapp.com.br", "not an origin"],
])("rejects mismatched or invalid origins (%s, %s)", async (host, origin) => {
    const response = await POST(request(host, origin));
    expect(response.status).toBe(403);
    expect(acknowledgeOwnerPush).not.toHaveBeenCalled();
});

test("allows an originless service-worker request while still checking the token", async () => {
    const response = await POST(request("www.imenuapp.com.br"));
    expect(response.status).toBe(200);
    expect(acknowledgeOwnerPush).toHaveBeenCalledWith(deviceToken, notificationId);
});

test("rejects invalid capability parameters before database access", async () => {
    const response = await POST(new NextRequest("http://internal:3000/api/push/ack", {
        method: "POST",
        headers: { Host: "www.imenuapp.com.br", Origin: "https://www.imenuapp.com.br" },
        body: JSON.stringify({ deviceToken: "short", notificationId }),
    }));
    expect(response.status).toBe(400);
    expect(acknowledgeOwnerPush).not.toHaveBeenCalled();
});

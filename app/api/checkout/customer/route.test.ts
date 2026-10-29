import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { trustCustomer, customerCookie } from "@/lib/services/checkoutCustomer";
import { POST } from "./route";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
const restaurantId = "30000000-0000-4000-8000-000000000001";
const phone = "19999991234";
beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "checkout-customer-test-secret";
});
function request(cookie = "", number = phone): NextRequest {
    return new NextRequest("https://imenu.example/api/checkout/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ restaurantId, phone: number }),
    });
}
test("phone alone never reveals a historical profile", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).customer).toBeNull();
    expect(query).not.toHaveBeenCalled();
});
test("signed snapshot is returned only for same device, store and phone", async () => {
    const signed = trustCustomer(NextResponse.json({ ok: true }), restaurantId, phone, {
        name: "Cliente", address: { rua: "Rua A", numero: "12" },
    });
    const cookie = signed.cookies.get(customerCookie(restaurantId))!;
    const cookieHeader = `${cookie.name}=${cookie.value}`;
    expect((await (await POST(request(cookieHeader))).json()).customer).toEqual({
        name: "Cliente", address: { rua: "Rua A", numero: "12" },
    });
    expect((await (await POST(request(cookieHeader, "11999999999"))).json()).customer).toBeNull();
    expect(query).not.toHaveBeenCalled();
});

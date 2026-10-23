import { POST } from "./route";
import { checkoutAddon } from "@/lib/addons/checkout";

jest.mock("@/lib/addons/checkout", () => ({ checkoutAddon: jest.fn() }));

it("never creates a QR payment, including renewal requests", async () => {
    for (const renew of [false, true]) {
        const response = await POST(new Request("https://example.com/api/qr-table/checkout", {
            method: "POST", body: JSON.stringify({ restaurantId: "restaurant", paymentMethod: "pix", renew }),
        }));
        expect(response.status).toBe(410);
        expect(await response.json()).toMatchObject({ error: expect.stringContaining("gratuito") });
    }
    expect(checkoutAddon).not.toHaveBeenCalled();
});

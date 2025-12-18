jest.mock("mercadopago", () => {
    return {
        MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
        Preference: jest.fn().mockImplementation(() => ({
            create: jest.fn().mockResolvedValue({
                id: "pref_123",
                init_point: "https://fake.mercadopago.com/init",
            }),
        })),
    };
});

import { POST } from "@/app/api/orders/route";
import * as sql from "@/lib/database/sql";
jest.mock("@/lib/database/sql");

describe("POST /api/orders", () => {
    it("creates an order successfully", async () => {
        // SELECT items
        (sql.query as jest.Mock).mockResolvedValueOnce({
            rows: [
                {
                    id: "item1",
                    name: "Pizza",
                    price_cents: 500,
                    restaurant_id: "test-restaurant-id",
                },
            ],
        });

        // INSERT order
        (sql.query as jest.Mock).mockResolvedValueOnce({
            rows: [{ id: "order-123" }],
        });

        const reqBody = {
            restaurantId: "test-restaurant-id", 
            items: [{ itemId: "item1", qty: 2 }],
            customer_name: "Rafa",
            customer_phone: "999999999",
            customer_address: "Rua Teste, 123",
            delivery_fee_cents: 0, 
            paymentMethod: "online", 
        };

        const req = new Request("http://localhost/api/orders", {
            method: "POST",
            body: JSON.stringify(reqBody),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toHaveProperty("order_id", "order-123");
        expect(json.init_point).toContain("mercadopago");
    });
});

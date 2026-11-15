import { query } from "@/lib/database/sql";
import { POST } from "./route";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

test("quotes a configured free delivery tier and rejects addresses beyond the radius", async () => {
    jest.mocked(query).mockResolvedValue({
        rows: [{
            latitude: "-20.55",
            longitude: "-48.58",
            delivery_fee_json: [
                { radius_km: 0.5, fee_cents: null, time_minutes: 50 },
                { radius_km: 1.5, fee_cents: 250, time_minutes: 60 },
            ],
        }],
    } as Awaited<ReturnType<typeof query>>);

    const quote = (latitude: number) => POST(new Request("https://i.menu/api/checkout/calculate-fee", {
        method: "POST",
        body: JSON.stringify({ restaurantId: "restaurant", latitude, longitude: -48.58 }),
    }));

    const free = await quote(-20.551);
    expect(free.status).toBe(200);
    expect(await free.json()).toMatchObject({ delivery_fee_cents: 0, delivery_time_minutes: 50 });

    const paid = await quote(-20.56);
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({ delivery_fee_cents: 250 });

    const outside = await quote(-20.58);
    expect(outside.status).toBe(400);
});

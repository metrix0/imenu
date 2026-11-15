import { POST } from "./route";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/analytics/affiliateAttribution", () => ({
    rememberAffiliateReferral: jest.fn(),
}));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    getAuthenticatedUser: jest.fn(),
}));

const mockQuery = jest.mocked(query);

function createRequest() {
    return new Request("http://localhost/api/restaurants/create", {
        method: "POST",
        body: JSON.stringify({ userId: "user", phone: "19999999999" }),
    });
}

test("creates the restaurant with the 1, 2 and 3 km delivery ranges before onboarding", async () => {
    mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ id: "new-restaurant" }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    const [insert, values] = mockQuery.mock.calls[1];
    expect(insert).toContain("delivery_fee_json");
    expect(insert).toContain("$3::jsonb");
    expect(JSON.parse(values![2] as string)).toEqual([
        { radius_km: 1, time_minutes: 40, fee_cents: 800 },
        { radius_km: 2, time_minutes: 40, fee_cents: 800 },
        { radius_km: 3, time_minutes: 50, fee_cents: 800 },
    ]);
});

test("a repeat request leaves an existing restaurant's delivery ranges intact", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-restaurant" }], rowCount: 1 });

    const response = await POST(createRequest());

    expect(await response.json()).toEqual({ id: "existing-restaurant" });
    expect(mockQuery).toHaveBeenCalledTimes(1);
});

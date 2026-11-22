import { GET } from "./route";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    ...jest.requireActual("@/lib/auth/restaurantOwner"),
    requireRestaurantOwner: jest.fn(),
}));

beforeEach(() => {
    jest.resetAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
});

it("retorna alertas de Pix e cartão Asaas cancelado com pagamento confirmado", async () => {
    (query as jest.Mock).mockResolvedValue({
        rows: [
            { id: "pix-1", product_key: "ia_plus", reminder_kind: "pix", current_period_ends_at: "2026-11-22T23:59:00Z" },
            { id: "card-1", product_key: "ia_plus", reminder_kind: "card", current_period_ends_at: "2026-11-22T23:59:00Z" },
        ],
    });
    const result = await GET(new Request("https://example.com/api/addons/expiring?restaurantId=restaurant-1"));
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.notices.map((n: { reminderKind: string }) => n.reminderKind)).toEqual(["pix", "card"]);
    const [sql, params] = (query as jest.Mock).mock.calls[0];
    expect(sql).toContain("payment_provider = 'mercadopago'");
    expect(sql).toContain("payment_provider = 'payzu'");
    expect(sql).toContain("payment_provider = 'asaas'");
    expect(sql).toContain("status = 'canceled'");
    expect(sql).toContain("asaas_subscription_id IS NOT NULL");
    expect(sql).toContain("payment.addon_id = restaurant_addons.id");
    expect(sql).toContain("payment.billing_type");
    expect(sql).toContain("payment.paid_at IS NOT NULL");
    expect(sql).toContain("current_period_ends_at AT TIME ZONE 'America/Sao_Paulo'");
    expect(params).toEqual(["restaurant-1"]);
});

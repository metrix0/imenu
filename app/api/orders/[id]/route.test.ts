import { DELETE } from "./route";
import { withTransaction } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn(),
    RestaurantOwnerAuthError: class RestaurantOwnerAuthError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "RestaurantOwnerAuthError";
            this.status = status;
        }
    },
}));

const orderId = "10000000-0000-4000-8000-000000000001";
const restaurantId = "30000000-0000-4000-8000-000000000001";
let dbQuery: jest.Mock;

function removeOrder() {
    return DELETE(
        new Request(`https://preview.imenuapp.com.br/api/orders/${orderId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurant_id: restaurantId }),
        }),
        { params: Promise.resolve({ id: orderId }) }
    );
}

function mockOrder(paymentMethod: string, paymentRef: string | null, firstPayoutStatus: string | null) {
    dbQuery.mockResolvedValueOnce({
        rows: [{
            id: orderId,
            payment_method: paymentMethod,
            payment_ref: paymentRef,
            first_payout_status: firstPayoutStatus,
        }],
        rowCount: 1,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    dbQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    (withTransaction as jest.Mock).mockImplementation(async (callback) => callback({ query: dbQuery }));
});

it.each([null, "pending", "processing", "failed", "cancelled"])(
    "blocks deleting paid online Pix orders when first payout is %s",
    async (payoutStatus) => {
        mockOrder("pix", "MP123", payoutStatus);

        const response = await removeOrder();

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
            error: "Este pedido não pode ser excluído enquanto o repasse Pix não estiver concluído. Repasses são realizados todos os dias às 12:00.",
        });
        expect(dbQuery).toHaveBeenCalledTimes(1);
        expect(dbQuery.mock.calls[0][0]).toContain("ORDER BY p.created_at ASC");
    }
);

it("deletes online Pix orders after their first corresponding payout is paid", async () => {
    mockOrder("pix", "MP123", "paid");

    const response = await removeOrder();

    expect(response.status).toBe(200);
    expect(dbQuery).toHaveBeenCalledTimes(3);
    expect(dbQuery.mock.calls[1][0]).toContain("DELETE FROM public.print_jobs");
    expect(dbQuery.mock.calls[2][0]).toContain("DELETE FROM public.orders");
});

it.each([
    ["dinheiro", null],
    ["pix", null],
])("preserves deletion of %s orders without confirmed online Pix payment", async (method, ref) => {
    mockOrder(method, ref, null);

    const response = await removeOrder();

    expect(response.status).toBe(200);
    expect(dbQuery).toHaveBeenCalledTimes(3);
});

it("returns 404 without deleting anything when the order does not exist", async () => {
    dbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await removeOrder();

    expect(response.status).toBe(404);
    expect(dbQuery).toHaveBeenCalledTimes(1);
});

import { PATCH } from "./route";
import { withTransaction } from "@/lib/database/sql";
import { getAuthenticatedUser, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { refundPayZuPixCharge } from "@/lib/payments/payzu";
import { notifyOrderStatusUpdate } from "@/lib/services/whatsappNotification";

jest.mock("@/lib/database/sql", () => ({ withTransaction: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    getAuthenticatedUser: jest.fn(),
    RestaurantOwnerAuthError: class RestaurantOwnerAuthError extends Error {
        constructor(message: string, public status: number) { super(message); }
    },
}));
jest.mock("@/lib/services/whatsappNotification", () => ({ notifyOrderStatusUpdate: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/payments/payzu", () => ({
    isPayZuPaymentRef: jest.fn(),
    refundPayZuPixCharge: jest.fn(),
}));

const order = {
    id: "order", status: "pending_physical_payment", payment_method: "dinheiro",
    payment_ref: null, restaurant_id: "restaurant", customer_phone: null,
    loyalty_points_used: 0, loyalty_credited: false, is_delivery: "entrega",
};
const client = { query: jest.fn() };
const send = (status: string, bearer = "Bearer owner-token") => PATCH(
    new Request("http://localhost/api/orders/order/status-order", {
        method: "PATCH",
        headers: bearer ? { Authorization: bearer } : {},
        body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: "order" }) }
);

beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockImplementation(async (request: Request) => {
        if (request.headers.get("Authorization") !== "Bearer owner-token") {
            throw new RestaurantOwnerAuthError("Não autenticado.", 401);
        }
        return { id: "owner" };
    });
    client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM orders")) return { rows: [{ ...order }] };
        if (sql.includes("FROM public.restaurants")) return { rows: [{ id: "restaurant" }] };
        return { rows: [] };
    });
    (withTransaction as jest.Mock).mockImplementation(async (callback: (client: { query: jest.Mock }) => unknown) => callback(client));
});

it("rejects missing or invalid authentication before querying orders", async () => {
    for (const bearer of ["", "Bearer fake-token"]) {
        const response = await send("done", bearer);
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ error: "Não autenticado." });
    }
    expect(withTransaction).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
    expect(notifyOrderStatusUpdate).not.toHaveBeenCalled();
});

it("rejects an authenticated user from another restaurant without updating status", async () => {
    client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM orders")) return { rows: [{ ...order }] };
        if (sql.includes("FROM public.restaurants")) return { rows: [] };
        return { rows: [] };
    });
    const response = await send("done");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "Acesso negado." });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls.every(([sql]) => !String(sql).includes("UPDATE orders"))).toBe(true);
    expect(notifyOrderStatusUpdate).not.toHaveBeenCalled();
});

it("does not refund another restaurant's paid PIX order", async () => {
    client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM orders")) return { rows: [{
            ...order, payment_method: "pix", payment_ref: "PIX00001",
            status: "paid", created_at: new Date().toISOString(),
        }] };
        if (sql.includes("FROM public.restaurants")) return { rows: [] };
        return { rows: [] };
    });
    const response = await send("canceled");
    expect(response.status).toBe(403);
    expect(refundPayZuPixCharge).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(2);
});

it("allows the restaurant owner to advance an offline order", async () => {
    const response = await send("preparing");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "preparing" });
    expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM public.restaurants"), ["restaurant", "owner"]
    );
    expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE orders"), ["preparing", "order"]
    );
    expect(notifyOrderStatusUpdate).toHaveBeenCalledWith("order", "preparing");
});

it("does not let an unpaid online PIX order be marked completed even by its owner", async () => {
    client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM orders")) return { rows: [{
            ...order, status: "pending_online_payment", payment_method: "pix",
            payment_ref: "123",
        }] };
        if (sql.includes("FROM public.restaurants")) return { rows: [{ id: "restaurant" }] };
        return { rows: [] };
    });
    const response = await send("done");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Pagamento PIX ainda não confirmado." });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(notifyOrderStatusUpdate).not.toHaveBeenCalled();
});

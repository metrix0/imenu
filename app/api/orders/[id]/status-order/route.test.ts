import { requestIfoodStatus } from "@/lib/delivery/ifoodStatus";
import { after } from "next/server";
import { PATCH } from "./route";
import { withTransaction } from "@/lib/database/sql";
import { getAuthenticatedUser, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { refundPayZuPixCharge } from "@/lib/payments/payzu";
import { notifyOrderStatusUpdate } from "@/lib/services/whatsappNotification";

jest.mock("@/lib/delivery/ifoodStatus", () => ({ requestIfoodStatus: jest.fn(), IfoodStatusError: class extends Error {} }));
jest.mock("next/server", () => ({ ...jest.requireActual("next/server"), after: jest.fn() }));
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
    (after as jest.Mock).mockImplementation(() => undefined);
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

 it("imported orders wait for iFood confirmation instead of updating local status",async()=>{
    client.query.mockImplementation(async(sql:string)=>({rows:sql.includes("FROM orders")?[{...order,is_imported:true}]:sql.includes("FROM public.restaurants")?[{id:"restaurant"}]:[]}));
    const response=await send("preparing");
    expect(requestIfoodStatus).toHaveBeenCalledWith("order","pending_physical_payment","preparing");
    expect(await response.json()).toMatchObject({status:"pending_physical_payment",ifoodPending:true});
    expect(client.query.mock.calls.every(([sql])=>!sql.includes("UPDATE orders"))).toBe(true);
 });

it("provider rejection leaves an imported order unchanged and returns its error",async()=>{
    client.query.mockImplementation(async(sql:string)=>({rows:sql.includes("FROM orders")?[{...order,is_imported:true}]:sql.includes("FROM public.restaurants")?[{id:"restaurant"}]:[]}));
    (requestIfoodStatus as jest.Mock).mockRejectedValueOnce(new Error("iFood recusou"));
    const response=await send("preparing");
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({error:"iFood recusou"});
    expect(client.query.mock.calls.every(([sql])=>!sql.includes("UPDATE orders"))).toBe(true);
});

describe("non-blocking NFC-e queue", () => {
    const originalEnv = process.env.NFCE_ENV;

    beforeEach(() => { process.env.NFCE_ENV = "producao"; });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.NFCE_ENV;
        else process.env.NFCE_ENV = originalEnv;
    });

    it("starts fiscal work only after the status transaction commits and response succeeds", async () => {
        const fiscal = await import("@/lib/nfce/service");
        const queued = jest.spyOn(fiscal, "queueOrderNote").mockResolvedValue(true);
        const processed = jest.spyOn(fiscal, "processNote").mockResolvedValue(true);
        let committed = false;
        (withTransaction as jest.Mock).mockImplementation(async (callback: (client: { query: jest.Mock }) => unknown) => {
            const result = await callback(client);
            committed = true;
            return result;
        });
        try {
            const response = await send("delivering");
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ ok: true, status: "delivering" });
            expect(committed).toBe(true);
            expect(notifyOrderStatusUpdate).toHaveBeenCalledWith("order", "delivering");
            expect(queued).not.toHaveBeenCalled();
            expect(after).toHaveBeenCalledTimes(1);

            await (after as jest.Mock).mock.calls[0][0]();
            expect(queued).toHaveBeenCalledWith(client, "restaurant", "order", "delivering", "entrega");
            expect(processed).toHaveBeenCalledWith("order");
        } finally {
            queued.mockRestore();
            processed.mockRestore();
        }
    });

    it("returns success and still notifies the customer when fiscal queueing fails", async () => {
        const fiscal = await import("@/lib/nfce/service");
        const queued = jest.spyOn(fiscal, "queueOrderNote").mockRejectedValue(new Error("fiscal database unavailable"));
        const processed = jest.spyOn(fiscal, "processNote").mockResolvedValue(true);
        const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const response = await send("done");
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ ok: true, status: "done" });
            expect(notifyOrderStatusUpdate).toHaveBeenCalledWith("order", "done");
            expect(queued).not.toHaveBeenCalled();
            await expect((after as jest.Mock).mock.calls[0][0]()).resolves.toBeUndefined();
            expect(processed).not.toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith(expect.stringContaining("[NFC-E]"), expect.any(Error));
        } finally {
            queued.mockRestore();
            processed.mockRestore();
            log.mockRestore();
        }
    });

    it("does not fail the status response when SEFAZ processing fails", async () => {
        const fiscal = await import("@/lib/nfce/service");
        const queued = jest.spyOn(fiscal, "queueOrderNote").mockResolvedValue(true);
        const processed = jest.spyOn(fiscal, "processNote").mockRejectedValue(new Error("SEFAZ offline"));
        const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const response = await send("delivering");
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ ok: true, status: "delivering" });
            expect(notifyOrderStatusUpdate).toHaveBeenCalledWith("order", "delivering");
            await expect((after as jest.Mock).mock.calls[0][0]()).resolves.toBeUndefined();
            expect(processed).toHaveBeenCalledWith("order");
            expect(log).toHaveBeenCalledWith(expect.stringContaining("[NFC-E]"), expect.any(Error));
        } finally {
            queued.mockRestore();
            processed.mockRestore();
            log.mockRestore();
        }
    });

    it("keeps status changes successful if scheduling fiscal work fails", async () => {
        (after as jest.Mock).mockImplementation(() => { throw new Error("post-response scheduling unavailable"); });
        const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const response = await send("delivering");
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ ok: true, status: "delivering" });
            expect(notifyOrderStatusUpdate).toHaveBeenCalledWith("order", "delivering");
            expect(log).toHaveBeenCalledWith(expect.stringContaining("[NFC-E]"), expect.any(Error));
        } finally {
            log.mockRestore();
        }
    });

    it("never queues NFC-e for an ineligible status", async () => {
        const fiscal = await import("@/lib/nfce/service");
        const queued = jest.spyOn(fiscal, "queueOrderNote").mockResolvedValue(false);
        try {
            const response = await send("preparing");
            expect(response.status).toBe(200);
            await (after as jest.Mock).mock.calls[0][0]();
            expect(queued).not.toHaveBeenCalled();
        } finally {
            queued.mockRestore();
        }
    });
});

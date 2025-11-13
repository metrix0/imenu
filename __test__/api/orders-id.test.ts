import { PATCH } from "@/app/api/orders/[id]/route";
import * as sql from "@/lib/sql";

jest.mock("@/lib/sql");

describe("PATCH /api/orders/[id]", () => {
    it("updates order status", async () => {
        (sql.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        const req = new Request("http://localhost/api/orders/abc", {
            method: "PATCH",
            body: JSON.stringify({ status: "delivering" }),
        });

        // ✅ FIX HERE:
        const context = { params: Promise.resolve({ id: "abc" }) } as any;

        const res = await PATCH(req, context);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.ok).toBe(true);
        expect(sql.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE orders SET status = $2 WHERE id = $1"),
            ["abc", "delivering"]
        );
    });
});

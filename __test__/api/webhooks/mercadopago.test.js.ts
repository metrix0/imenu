import { POST } from "@/app/api/webhooks/mercadopago/route";
import * as sql from "@/lib/sql";

jest.mock("@/lib/sql");

describe("POST /api/webhooks/mercadopago", () => {
    it("marks order as paid", async () => {
        (sql.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        const req = new Request("http://localhost/api/webhooks/mercadopago?id=131650193470&topic=payment", {
            method: "POST",
            body: JSON.stringify({
                data: { id: "131650193470" },
                type: "payment",
            }),
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.ok).toBe(true);
        expect(sql.query).toHaveBeenCalled();
    });
});

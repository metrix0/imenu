import { devPage, paged } from "../pagination";
import { getCrm } from "../crm";
import { payoutHistory } from "../payoutHistory";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

test.each(["-1", "NaN", "1.5", "Infinity", "1;DELETE FROM restaurants"])("invalid page %s cannot reach SQL", value => {
    expect(devPage(new URLSearchParams({ page: value }))).toBe(0);
});

test("empty and partial pages keep a usable page count", () => {
    expect(paged([], 0, 0).pageCount).toBe(1);
    expect(paged([], 26, 1).pageCount).toBe(2);
});

test("CRM fetches only 10 restaurants, parameterizes search, and distinguishes historical payment from access", async () => {
    (query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: sql.includes("COUNT(*)::int total") ? [{ total: 26 }] : [], rowCount: 0 }));
    const result = await getCrm(new URLSearchParams({ paid: "1", page: "1", q: "' OR TRUE --" }));
    expect(result).toHaveProperty("pageCount", 3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"), ["' OR TRUE --", 10, 10]);
    expect((query as jest.Mock).mock.calls[0][0]).not.toContain("' OR TRUE --");
    expect((query as jest.Mock).mock.calls[0][0]).toContain("p.paid_at IS NOT NULL");
});

test.each(["1","0"])("both CRM lists use 10-row pages: paid=%s",async(paid)=>{
 (query as jest.Mock).mockImplementation(async(sql:string)=>({rows:sql.includes("COUNT(*)::int total")?[{total:21}]:[]}));
 const data=await getCrm(new URLSearchParams({paid,page:"2"}));
 expect(data).toMatchObject({page:2,pageCount:3,total:21});
 expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"),["",10,20]);
});


test.each(["failed", "history", "runs"])("payout %s history uses 10-row pages", async section => {
    (query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: sql.includes("COUNT(*)::int total") ? [{ total: 21 }] : [] }));
    const result = await payoutHistory(new URLSearchParams({ section, page: "2" }));
    expect(result).toMatchObject({ page: 2, pageCount: 3, total: 21 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $1 OFFSET $2"), [10, 20]);
    const sql = (query as jest.Mock).mock.calls[0][0];
    if (section === "failed") {
        expect(sql).toContain("LEFT JOIN whatsapp_outbound_messages alert");
        expect(sql).toContain("alert.status alert_status");
        expect(sql).toContain("p.created_at AT TIME ZONE 'America/Sao_Paulo'");
        expect(sql).toContain("WHERE p.status='failed'");
    } else {
        expect(sql).not.toContain("JOIN whatsapp_outbound_messages");
    }
});

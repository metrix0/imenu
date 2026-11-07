import { conversion, formatCount, formatRatio, firstPhone, normalizeWhatsappNumber, accountAge, monthsSince, formatResponseTime } from "../dashboardFormat";

describe("developer dashboard formatters", () => {
    it("preserves numeric and conversion formatting", () => {
        expect(formatCount(1234)).toBe("1.234");
        expect(formatRatio(12.5)).toBe("12,5%");
        expect(conversion(5, 20)).toBe(25);
        expect(conversion(0, 0)).toBeNull();
    });
    it("normalizes the first WhatsApp contact", () => {
        expect(firstPhone("11999998888, 11988887777")).toBe("11999998888");
        expect(normalizeWhatsappNumber("11999998888")).toBe("5511999998888");
    });
});

const ageNow = new Date("2026-03-15T12:00:00Z");
test.each([
 ["2026-03-14T12:00:00Z","1 semana"],
 ["2026-03-08T12:00:00Z","1 semana"],
 ["2026-03-07T12:00:00Z","2 semanas"],
 ["2026-02-15T12:00:00Z","1 mês"],
 ["2026-02-15T11:59:59Z","2 meses"],
 ["2026-01-15T12:00:00Z","2 meses"],
 ["2026-01-14T12:00:00Z","3 meses"],
])("account age rounds calendar periods for %s",(value,expected)=>{
 expect(accountAge(value,ageNow)).toBe(expected);
});
test("Plus tenure rounds up months and handles short months",()=>{
 expect(monthsSince("2026-03-14T12:00:00Z",ageNow)).toBe("1 mês");
 expect(monthsSince("2026-01-31T12:00:00Z",new Date("2026-02-28T12:00:00Z"))).toBe("1 mês");
 expect(monthsSince("2026-01-31T12:00:00Z",new Date("2026-02-28T12:00:01Z"))).toBe("2 meses");
 expect(accountAge("invalid",ageNow)).toBe("—");
 expect(accountAge("2027-01-01",ageNow)).toBe("—");
});


test.each([[170,"2m 50s"],[18240,"5h 4m"],[3599.8,"1h 0m"],[0,"0m 0s"],[null,"—"],[NaN,"—"]])("formats response duration %s",(value,expected)=>{
 expect(formatResponseTime(value as number|null)).toBe(expected);
});

import { conversion, formatCount, formatRatio, firstPhone, normalizeWhatsappNumber } from "../dashboardFormat";

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

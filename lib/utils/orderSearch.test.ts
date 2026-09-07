import { orderSearchFilter } from "./orderSearch";

describe("history search", () => {
    it("does not filter blank searches", () => {
        expect(orderSearchFilter("  ")).toBe("");
    });

    it("searches numeric terms by order number and customer fields", () => {
        expect(orderSearchFilter("#42")).toContain("display_id.eq.42,");
        expect(orderSearchFilter("42")).toContain('customer_name.ilike."%42%"');
        expect(orderSearchFilter("42")).toContain('customer_address.ilike."%42%"');
    });

    it("quotes punctuation without introducing another filter", () => {
        const term = 'Rua "A", (Centro)';
        const quoted = JSON.stringify(`%${term}%`);
        expect(orderSearchFilter(term)).toBe(`customer_name.ilike.${quoted},customer_address.ilike.${quoted}`);
    });

    it("does not send invalid bigint values to the number column", () => {
        expect(orderSearchFilter("9223372036854775808")).not.toContain("display_id");
        expect(orderSearchFilter("12A")).not.toContain("display_id");
    });

    it("treats percent and underscore as literal text", () => {
        expect(orderSearchFilter("100%_" )).toBe('customer_name.ilike."%100\\\\%\\\\_%",customer_address.ilike."%100\\\\%\\\\_%"');
    });
});

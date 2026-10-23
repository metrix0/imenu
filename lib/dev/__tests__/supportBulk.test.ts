import { parseBulkPhones, parseBulkRecipients, renderBulkMessage } from "../supportBulk";

describe("support blast table helpers", () => {
    const table = "| Nome | WhatsApp | Cidade |\n| --- | --- | --- |\n| Maria | (19) 99999-1111 | Limeira |\n| João | (19) 99999-2222 | Rio Claro |";
    it("keeps columns, phone order and deduplication", () => {
        const recipients = parseBulkRecipients(table);
        expect(recipients).toHaveLength(2);
        expect(recipients[0]).toEqual({ phone: "(19) 99999-1111", values: { Nome: "Maria", WhatsApp: "(19) 99999-1111", Cidade: "Limeira" } });
        expect(parseBulkPhones("(19) 99999-1111\n(19) 99999-1111")).toHaveLength(1);
    });
    it("preserves variable substitution and missing-field validation", () => {
        expect(renderBulkMessage("Olá {{Nome}}, de {{Cidade}}!", { Nome: "Maria", Cidade: "Limeira" })).toBe("Olá Maria, de Limeira!");
        expect(() => renderBulkMessage("Olá {{Nome}}", {})).toThrow(/Nome/);
    });
});

import { buildMobileReceiptPdf, DEFAULT_MOBILE_PRINT, parseMobilePrintSettings, SAMPLE_RECEIPT } from "../mobileReceipt";

function pdfText(bytes: Uint8Array) { return Buffer.from(bytes).toString("ascii"); }
function contentText(pdf: string) {
    return [...pdf.matchAll(/<([0-9a-f]+)> Tj/g)].map(match => Buffer.from(match[1], "hex").toString("latin1")).join("\n");
}

describe("mobile receipt PDF", () => {
    it("defaults to disabled and normalizes untrusted settings", () => {
        expect(parseMobilePrintSettings(null)).toEqual(DEFAULT_MOBILE_PRINT);
        expect(parseMobilePrintSettings({ enabled: "true", paper: 80, showTotals: false })).toMatchObject({ enabled: false, paper: "58", showTotals: false });
    });
    it.each([["58", "164.41"], ["80", "226.77"], ["a4", "595.28"]] as const)("generates valid %s paper with correct PDF offsets", (paper, width) => {
        const pdf = pdfText(buildMobileReceiptPdf(SAMPLE_RECEIPT, { ...DEFAULT_MOBILE_PRINT, paper }));
        expect(pdf).toContain("/MediaBox [0 0 " + width);
        expect(pdf).toMatch(/^%PDF-1\.4/);
        const offset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
        expect(pdf.slice(offset, offset + 4)).toBe("xref");
        const xrefs = pdf.slice(offset).matchAll(/(\d{10}) 00000 n /g);
        let i = 1;
        for (const entry of xrefs) { expect(pdf.slice(Number(entry[1]))).toMatch(new RegExp("^" + i++ + " 0 obj")); }
        expect(i).toBeGreaterThan(5);
        expect(contentText(pdf)).toContain("Sem cebola");
        expect(contentText(pdf)).toContain("R$ 46,00");
    });
    it("preserves receipt data and conditional fields", () => {
        const settings = { ...DEFAULT_MOBILE_PRINT, showCustomerName: false, showObservations: false, showSubitems: false, showItemPrices: false, showTotals: false, showPayment: false };
        const text = contentText(pdfText(buildMobileReceiptPdf(SAMPLE_RECEIPT, settings)));
        expect(text).not.toContain("Maria");
        expect(text).not.toContain("Bacon");
        expect(text).not.toContain("Sem cebola");
        expect(text).not.toContain("R$");
        expect(text).toContain("X-Burger");
    });
    it("handles table, pickup and scheduled delivery correctly", () => {
        const table = { ...SAMPLE_RECEIPT, order: { ...SAMPLE_RECEIPT.order, is_delivery: "mesa", table_name_snapshot: "Mesa 5" } };
        const text = contentText(pdfText(buildMobileReceiptPdf(table, DEFAULT_MOBILE_PRINT)));
        expect(text).toContain("Mesa 5");
        expect(text).not.toContain("Rua Exemplo");
        expect(text).not.toContain("Pix");
        const scheduled = { ...SAMPLE_RECEIPT, order: { ...SAMPLE_RECEIPT.order, is_delivery: "retirada", scheduled_for: "2026-09-26T15:30:00Z", customer_name: "João" } };
        const pickup = contentText(pdfText(buildMobileReceiptPdf(scheduled, DEFAULT_MOBILE_PRINT)));
        expect(pickup).toContain("AGENDADO");
        expect(pickup).toContain("RETIRADA:");
        expect(pickup).toContain("João");
        expect(pickup).not.toContain("Rua Exemplo");
    });
    it("wraps long names and observations and splits long receipts", () => {
        const item = { ...SAMPLE_RECEIPT.items[0], name: "A".repeat(200), observation: "Observação ".repeat(100) };
        const pdf = pdfText(buildMobileReceiptPdf({ ...SAMPLE_RECEIPT, items: Array.from({ length: 20 }, () => item) }, DEFAULT_MOBILE_PRINT));
        expect(Number(pdf.match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(1);
        expect(contentText(pdf)).toContain("Observação");
    });
});

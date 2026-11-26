// Manual PDF receipts are deliberately independent of the automatic printer queue.
export const RECEIPT_FIELDS = {
    showCustomerName: "Nome do cliente", showCustomerPhone: "Telefone",
    showAddress: "Endereço", showPayment: "Pagamento", showItemPrices: "Preços",
    showTotals: "Totais",
} as const;
type Field = keyof typeof RECEIPT_FIELDS;
type Size = "normal" | "large";
type ExtendedSize = Size | "extra";
export type MobilePrintSettings = Record<Field, boolean> & {
    enabled: boolean; paper: "58" | "80" | "a4"; title: string; footer: string;
    textSize: Size;
};
export const DEFAULT_MOBILE_PRINT: MobilePrintSettings = {
    enabled: false, paper: "58", title: "COZINHA", footer: "",
    textSize: "normal",
    showCustomerName: true,
    showCustomerPhone: true, showAddress: true, showPayment: true, showItemPrices: true,
    showTotals: true,
};
export function parseMobilePrintSettings(raw: unknown): MobilePrintSettings {
    const v = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const size = (value: unknown, fallback: Size): Size => value === "normal" || value === "large" ? value : fallback;
    const result: MobilePrintSettings = {
        ...DEFAULT_MOBILE_PRINT, enabled: v.enabled === true,
        paper: v.paper === "80" || v.paper === "a4" ? v.paper : "58",
        title: typeof v.title === "string" ? v.title.slice(0, 24) : "COZINHA",
        footer: typeof v.footer === "string" ? v.footer.slice(0, 120) : "",
        textSize: size(v.textSize, "normal"),
    };
    for (const field of Object.keys(RECEIPT_FIELDS) as Field[]) result[field] = v[field] !== false;
    return result;
}
type Cents = number | string | null;
export type ReceiptData = {
    order: {
        display_id: number | string | null; created_at: string; scheduled_for?: string | null;
        customer_name?: string | null; customer_phone?: string | null; customer_address?: string | null;
        payment_method?: string | null; is_delivery?: string | null; table_name_snapshot?: string | null;
        subtotal_cents: Cents; delivery_cents: Cents; coupon_discount_cents?: Cents; total_cents: Cents;
    };
    items: { id: string; name: string; quantity: number; observation?: string | null; price_cents: Cents; total_cents: Cents }[];
    subitems: { order_item_id: string; name: string; quantity: number; price_cents: Cents }[];
};
type Line = { text: string; size: number; bold: boolean; align: "left" | "center" | "right"; height: number };
function printable(value: unknown) {
    return String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/\s+/g, " ")
        .replace(/[^\x20-\x7e\xa0-\xff]/g, "?").trim();
}
function wrap(value: string, columns: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of printable(value).split(" ").filter(Boolean)) {
        if (line && line.length + 1 + word.length <= columns) { line += " " + word; continue; }
        if (line) lines.push(line);
        line = word;
        while (line.length > columns) { lines.push(line.slice(0, columns)); line = line.slice(columns); }
    }
    if (line) lines.push(line);
    return lines;
}
function numeric(value: Cents | undefined, fallback = 0) {
    return value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
}
const money = (cents: number) => "R$ " + (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = (value: number) => Math.max(1, Number(value) || 1);
function dateLabel(value?: string | null) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}
function paymentLabel(method: string) {
    const labels: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", "pix-entrega": "Pix na entrega", "trazer-maquininha": "Maquininha" };
    return labels[method] || method;
}
// Courier/WinAnsi provides predictable character widths and Portuguese accents without a new dependency.
export function layoutMobileReceipt(data: ReceiptData, settings: MobilePrintSettings) {
    const width = settings.paper === "a4" ? 595.28 : settings.paper === "80" ? 226.77 : 164.41;
    const margin = settings.paper === "a4" ? 42 : 9;
    const available = width - margin * 2;
    const base = (settings.paper === "a4" ? 11 : 7.5) * (settings.textSize === "large" ? 1.2 : 1);
    const font = (size: ExtendedSize) => base * (size === "extra" ? 1.8 : size === "large" ? 1.35 : 1);
    const columns = (size: number) => Math.max(1, Math.floor(available / (size * 0.6)));
    const lines: Line[] = [];
    const add = (text: unknown, size = font("normal"), bold = false, align: Line["align"] = "left") => {
        for (const line of wrap(printable(text), columns(size))) lines.push({ text: line, size, bold, align, height: size * 1.32 });
    };
    const gap = () => {
        const height = base * 0.75;
        if (height) lines.push({ text: "", size: base, bold: false, align: "left", height });
    };
    const separator = () => { gap(); add("-".repeat(columns(base)), base); gap(); };
    const row = (left: string, right: string, size = font("normal"), bold = false) => {
        const a = printable(left), b = printable(right), count = columns(size);
        if (!b) { add(a, size, bold); return; }
        if (a.length + b.length + 1 <= count) {
            // Preserve alignment spaces directly rather than using the wrapping normalizer.
            lines.push({ text: a + " ".repeat(count - a.length - b.length) + b, size, bold, align: "left", height: size * 1.32 });
        } else { add(a, size, bold); add(b, size, bold, "right"); }
    };
    const { order, items, subitems } = data;
    const destination = String(order.is_delivery ?? "").trim().toLowerCase();
    const table = destination === "mesa";
    const pickup = ["retirada", "pickup", "balcao", "balcão", "false", "0"].includes(destination);
    if (settings.title.trim()) { add(settings.title.trim(), base, true, "center"); gap(); }
    add("PEDIDO #" + (order.display_id ?? "-"), font("extra"), true, "center");
    const scheduled = dateLabel(order.scheduled_for);
    if (scheduled && !table) {
        separator(); add("AGENDADO", font("extra"), true, "center");
        add((pickup ? "RETIRADA: " : "ENTREGA: ") + scheduled, base, true, "center"); separator();
    }
    if (table) { add("Tipo: Mesa"); add("Mesa: " + (order.table_name_snapshot || "Mesa")); }
    else if (pickup) add("Tipo: Retirada");
    if (settings.showCustomerName && order.customer_name) add(order.customer_name, font("large"), true);
    if (settings.showCustomerPhone && !table) add(order.customer_phone);
    if (settings.showAddress && !table && !pickup) add(order.customer_address);
    separator();
    const grouped = new Map<string, ReceiptData["subitems"]>();
    for (const sub of subitems) { const group = grouped.get(sub.order_item_id) || []; group.push(sub); grouped.set(sub.order_item_id, group); }
    for (const item of items) {
        const qty = quantity(item.quantity);
        const label = qty + "x " + item.name;
        row(label, settings.showItemPrices ? money(numeric(item.total_cents, numeric(item.price_cents) * qty)) : "", font("large"), true);
        for (const sub of grouped.get(item.id) || []) {
            const qty = quantity(sub.quantity), price = numeric(sub.price_cents);
            row("  " + qty + "x " + sub.name, settings.showItemPrices && price > 0 ? "+" + money(price * qty) : "");
        }
        if (item.observation) add("OBS: " + item.observation, font("normal"), true);
    }
    separator();
    const subtotal = numeric(order.subtotal_cents), delivery = pickup || table ? 0 : numeric(order.delivery_cents);
    const storedDiscount = numeric(order.coupon_discount_cents);
    const discount = storedDiscount > 0 ? storedDiscount : Math.max(subtotal + delivery - numeric(order.total_cents), 0);
    const total = numeric(order.total_cents, subtotal + delivery - discount);
    if (settings.showTotals) {
        row("Subtotal", money(subtotal));
        if (delivery > 0) row("Entrega", money(delivery));
        if (discount > 0) row("Desconto", "-" + money(discount));
        gap();
        const size = font("extra");
        row("TOTAL", money(total), size === font("extra") && ("TOTAL".length + money(total).length + 1 > columns(size) || settings.paper === "58") ? font("large") : size, true);
    }
    if (settings.showPayment && !table && order.payment_method) row(paymentLabel(order.payment_method), money(total));
    gap(); add(settings.footer, font("normal"), false, "center");
    add(dateLabel(order.created_at), font("normal"), false, "center");
    // Fixed A4 pages, or variable-height thermal pages with a bounded maximum for mobile PDF viewers.
    const maxHeight = settings.paper === "a4" ? 841.89 : 1800;
    const pages: { lines: Line[]; used: number }[] = [{ lines: [], used: 0 }];
    for (const line of lines) {
        let page = pages[pages.length - 1];
        if (page.used + line.height > maxHeight - 2 * margin && page.lines.length) {
            page = { lines: [], used: 0 }; pages.push(page);
        }
        page.lines.push(line); page.used += line.height;
    }
    return pages.map(page => {
        const height = settings.paper === "a4" ? maxHeight : Math.max(72, page.used + 2 * margin + 8);
        let y = margin;
        const positioned = page.lines.map(line => {
            const baseline = y + line.size; y += line.height;
            const textWidth = line.text.length * line.size * 0.6;
            const x = line.align === "center" ? (width - textWidth) / 2 : line.align === "right" ? width - margin - textWidth : margin;
            return { ...line, x, y: baseline, textWidth };
        });
        return { width, height, lines: positioned };
    });
}

export function buildMobileReceiptPdf(data: ReceiptData, settings: MobilePrintSettings): Uint8Array<ArrayBuffer> {
    const pages = layoutMobileReceipt(data, settings);
    const objects: string[] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [" + pages.map((_, i) => (5 + i * 2) + " 0 R").join(" ") + "] /Count " + pages.length + " >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    ];
    const n = (v: number) => v.toFixed(2);
    for (const [index, page] of pages.entries()) {
        const { width, height } = page;
        const content = page.lines.map(line => {
            if (!line.text) return "";
            const hex = Array.from(line.text, char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
            return "0 g BT /" + (line.bold ? "F2" : "F1") + " " + n(line.size) + " Tf 1 0 0 1 " + n(line.x) + " " + n(height - line.y) + " Tm <" + hex + "> Tj ET";
        }).join("\n") + "\n";
        objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + n(width) + " " + n(height) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (6 + index * 2) + " 0 R >>");
        objects.push("<< /Length " + content.length + " >>\nstream\n" + content + "endstream");
    }
    // All PDF syntax is ASCII; receipt text is hex-encoded Latin-1. String offsets are byte offsets.
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; });
    const xref = pdf.length;
    pdf += "xref\n0 " + offsets.length + "\n0000000000 65535 f \n" + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("") +
        "trailer\n<< /Size " + offsets.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return new TextEncoder().encode(pdf);
}
export const SAMPLE_RECEIPT: ReceiptData = {
    order: { display_id: 42, created_at: "2026-09-26T15:30:00Z", customer_name: "Maria", customer_phone: "(11) 99999-9999",
        customer_address: "Rua Exemplo, 123 - Centro", payment_method: "pix", is_delivery: "entrega",
        subtotal_cents: 4100, delivery_cents: 500, total_cents: 4600 },
    items: [{ id: "sample", name: "X-Burger", quantity: 2, price_cents: 1900, total_cents: 3800, observation: "Sem cebola" }],
    subitems: [{ order_item_id: "sample", name: "Bacon", quantity: 1, price_cents: 300 }],
};

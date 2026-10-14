export type PrintableMenuItem = {
    name: string;
    description: string | null;
    price_cents: number;
};

export type PrintableMenuCategory = {
    name: string;
    items: PrintableMenuItem[];
};

type MenuPdfInput = {
    restaurantName: string;
    categories: PrintableMenuCategory[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 52;
const RIGHT = PAGE_WIDTH - LEFT;
const CONTENT_BOTTOM = 763;
const ITEM_WIDTH = RIGHT - LEFT - 92;

function printable(value: string): string {
    return value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "");
}

function textHex(value: string): string {
    return Buffer.from(printable(value), "latin1").toString("hex");
}

function widthOf(value: string, fontSize: number): number {
    return [...printable(value)].reduce((total, char) => {
        const relativeWidth = /[ilI.,!:'| ]/.test(char)
            ? 0.28
            : /[mwMW@%]/.test(char)
              ? 0.86
              : /[A-ZÀ-ÖØ-Þ]/.test(char)
                ? 0.69
                : 0.57;
        return total + relativeWidth * fontSize;
    }, 0);
}

function wrapText(value: string, maxWidth: number, fontSize: number): string[] {
    const words = printable(value).split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (widthOf(candidate, fontSize) <= maxWidth) {
            line = candidate;
            continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const letter of word) {
            if (line && widthOf(line + letter, fontSize) > maxWidth) {
                lines.push(line);
                line = "";
            }
            line += letter;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function brl(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value / 100);
}

export function buildPrintableMenuPdf(input: MenuPdfInput): Buffer {
    const restaurant = printable(input.restaurantName) || "Restaurante";
    const pages: string[][] = [];
    let commands: string[] = [];
    let y = 0;

    function emit(command: string) {
        commands.push(command);
    }

    function line(x1: number, top1: number, x2: number, top2: number, shade = 0.88, thickness = 0.6) {
        emit(`${shade} G ${thickness} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - top2).toFixed(2)} l S`);
    }

    function text(value: string, x: number, top: number, size: number, bold = false, shade = 0.17) {
        const hex = textHex(value);
        if (!hex) return;
        emit(`${shade} g BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(PAGE_HEIGHT - top).toFixed(2)} Tm <${hex}> Tj ET`);
    }

    function page() {
        commands = [];
        pages.push(commands);
        y = 0;
        emit("0.84 0.24 0.06 rg 52 806 32 3 re f");
        text("CARDÁPIO", LEFT, 66, 10, true, 0.38);
        const titleLines = wrapText(restaurant, RIGHT - LEFT, 25);
        for (const title of titleLines.slice(0, 2)) {
            text(title, LEFT, 106 + y, 25, true, 0.11);
            y += 30;
        }
        y += 100;
        line(LEFT, y, RIGHT, y, 0.83);
        y += 27;
    }

    function requireSpace(height: number) {
        if (y + height > CONTENT_BOTTOM) page();
    }

    page();
    let printed = 0;
    for (const category of input.categories) {
        const items = category.items.filter((item) => item.name.trim() && Number.isFinite(item.price_cents));
        if (!items.length) continue;

        const titleLines = wrapText(category.name || "Outros", RIGHT - LEFT, 15);
        const categoryHeight = titleLines.length * 19 + 15;
        const firstName = wrapText(items[0].name, ITEM_WIDTH, 11.5);
        requireSpace(categoryHeight + firstName.length * 16 + 18);
        for (const categoryLine of titleLines) {
            text(categoryLine, LEFT, y + 8, 15, true, 0.16);
            y += 19;
        }
        y += 12;

        for (const item of items) {
            const nameLines = wrapText(item.name, ITEM_WIDTH, 11.5);
            const descriptionLines = item.description
                ? wrapText(item.description, ITEM_WIDTH, 9.2)
                : [];
            const rowHeight = nameLines.length * 16 + descriptionLines.length * 13 + 21;
            requireSpace(rowHeight);
            line(LEFT, y, RIGHT, y, 0.94, 0.45);
            const start = y + 18;
            for (let index = 0; index < nameLines.length; index++) {
                text(nameLines[index], LEFT, start + index * 16, 11.5, true, 0.13);
            }
            const price = brl(item.price_cents);
            text(price, RIGHT - widthOf(price, 11), start, 11, true, 0.14);
            for (let index = 0; index < descriptionLines.length; index++) {
                text(descriptionLines[index], LEFT, start + nameLines.length * 16 + index * 13, 9.2, false, 0.42);
            }
            y += rowHeight;
            printed++;
        }
        y += 17;
    }

    if (printed === 0) {
        text("Nenhum produto disponível no cardápio.", LEFT, y + 10, 11, false, 0.4);
    }

    const allPages = pages.length;
    for (let index = 0; index < allPages; index++) {
        const current = commands;
        commands = pages[index];
        line(LEFT, 787, RIGHT, 787, 0.85);
        text(restaurant, LEFT, 807, 8.5, false, 0.4);
        const number = `${index + 1} / ${allPages}`;
        text(number, RIGHT - widthOf(number, 8.5), 807, 8.5, false, 0.4);
        commands = current;
    }

    // Object offsets refer to byte positions, not JavaScript string lengths.
    const objects: Buffer[] = [];
    const addObject = (value: string | Buffer) => {
        objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1"));
    };
    addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
    addObject(`<< /Type /Pages /Kids [${pageRefs}] /Count ${allPages} >>`);
    addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

    pages.forEach((drawing, index) => {
        const contentId = 6 + index * 2;
        addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
        const content = Buffer.from(drawing.join("\n") + "\n", "ascii");
        addObject(Buffer.concat([
            Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"),
            content,
            Buffer.from("endstream", "ascii"),
        ]));
    });

    const bytes: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    let offset = bytes[0].length;
    const offsets = [0];
    for (let index = 0; index < objects.length; index++) {
        const header = Buffer.from(`${index + 1} 0 obj\n`, "ascii");
        const footer = Buffer.from("\nendobj\n", "ascii");
        offsets.push(offset);
        bytes.push(header, objects[index], footer);
        offset += header.length + objects[index].length + footer.length;
    }
    const xrefOffset = offset;
    const xref = [
        "xref",
        `0 ${objects.length + 1}`,
        "0000000000 65535 f ",
        ...offsets.slice(1).map((position) => `${String(position).padStart(10, "0")} 00000 n `),
        "trailer",
        `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
        "startxref",
        String(xrefOffset),
        "%%EOF",
        "",
    ].join("\n");
    bytes.push(Buffer.from(xref, "ascii"));
    return Buffer.concat(bytes);
}

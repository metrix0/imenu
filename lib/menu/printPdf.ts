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
    const categories = input.categories
        .map((category) => ({
            name: category.name || "Outros",
            items: category.items.filter((item) => item.name.trim() && Number.isFinite(item.price_cents)),
        }))
        .filter((category) => category.items.length > 0);

    type Layout = { columns: 1 | 2; compact: boolean };
    const renderLayout = ({ columns, compact }: Layout): string[][] => {
        const pages: string[][] = [];
        let commands: string[] = [];
        let column = 0;
        let y = 0;
        let top = 0;

        const gutter = columns === 2 ? 24 : 0;
        const columnWidth = (RIGHT - LEFT - gutter) / columns;
        const headingSize = (columns === 2 ? 12.6 : 15) * (compact ? 0.92 : 1);
        const itemSize = (columns === 2 ? 10.1 : 11.5) * (compact ? 0.91 : 1);
        const descriptionSize = (columns === 2 ? 8.35 : 9.2) * (compact ? 0.91 : 1);
        const headingLine = headingSize * 1.28;
        const itemLine = itemSize * 1.36;
        const descriptionLine = descriptionSize * 1.42;
        const rowPadding = compact ? 14 : 20;
        const sectionPadding = compact ? 13 : 19;
        const bottom = compact ? 773 : CONTENT_BOTTOM;

        const x = () => LEFT + column * (columnWidth + gutter);
        const right = () => x() + columnWidth;
        const itemTextWidth = columnWidth - (columns === 2 ? 76 : 92);

        const emit = (command: string) => commands.push(command);

        const drawLine = (x1: number, top1: number, x2: number, top2: number, shade = 0.88, thickness = 0.6) => {
            emit(`${shade} G ${thickness} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - top2).toFixed(2)} l S`);
        };

        const drawText = (value: string, atX: number, atTop: number, fontSize: number, bold = false, shade = 0.17) => {
            const hex = textHex(value);
            if (!hex) return;
            emit(`${shade} g BT /${bold ? "F2" : "F1"} ${fontSize.toFixed(2)} Tf 1 0 0 1 ${atX.toFixed(2)} ${(PAGE_HEIGHT - atTop).toFixed(2)} Tm <${hex}> Tj ET`);
        };

        const newPage = () => {
            commands = [];
            pages.push(commands);
            column = 0;
            if (pages.length === 1) {
                emit("0.84 0.24 0.06 rg 52 806 32 3 re f");
                drawText("CARDÁPIO", LEFT, 66, 10, true, 0.38);
                const titles = wrapText(restaurant, RIGHT - LEFT, 25).slice(0, 2);
                titles.forEach((title, index) => drawText(title, LEFT, 106 + index * 30, 25, true, 0.11));
                top = 165 + Math.max(0, titles.length - 1) * 30;
                drawLine(LEFT, top - 20, RIGHT, top - 20, 0.83);
            } else {
                top = 62;
                drawLine(LEFT, 45, RIGHT, 45, 0.9);
            }
            y = top;
            if (columns === 2) {
                const center = LEFT + columnWidth + gutter / 2;
                drawLine(center, top - 6, center, bottom, 0.93, 0.5);
            }
        };

        const nextColumn = () => {
            if (columns === 2 && column === 0) {
                column = 1;
                y = top;
            } else {
                newPage();
            }
        };

        const headingHeight = (name: string) =>
            wrapText(name, columnWidth, headingSize).length * headingLine + sectionPadding;

        const drawHeading = (name: string) => {
            const lines = wrapText(name, columnWidth - 7, headingSize);
            const height = lines.length * headingLine + sectionPadding;
            if (y + height + itemLine + rowPadding > bottom) nextColumn();

            const start = y + headingLine - 1;
            for (let index = 0; index < lines.length; index++) {
                drawText(lines[index], x(), start + index * headingLine, headingSize, true, 0.16);
            }
            y += height;
        };

        const moveWithinCategory = () => {
            nextColumn();
        };

        newPage();
        for (const category of categories) {
            drawHeading(category.name);
            for (const item of category.items) {
                const description = item.description
                    ? wrapText(item.description, columnWidth - 2, descriptionSize)
                    : [];
                let descriptionOffset = 0;
                let firstSegment = true;

                do {
                    const name = firstSegment ? item.name : `${item.name} (continuação)`;
                    const nameLines = wrapText(name, itemTextWidth, itemSize);
                    const baseHeight = rowPadding + nameLines.length * itemLine;
                    const remaining = description.length - descriptionOffset;
                    const fullHeight = baseHeight + remaining * descriptionLine;
                    const maxItemHeight = bottom - 62 - headingHeight(category.name) - 12;

                    // Keep ordinary items together; split only unusually long descriptions.
                    if (y + fullHeight > bottom && fullHeight <= maxItemHeight) {
                        moveWithinCategory();
                        continue;
                    }
                    if (y + baseHeight + (remaining ? descriptionLine : 0) > bottom) {
                        moveWithinCategory();
                        continue;
                    }

                    const count = Math.min(
                        remaining,
                        Math.max(0, Math.floor((bottom - y - baseHeight) / descriptionLine)),
                    );
                    drawLine(x(), y, right(), y, 0.94, 0.45);
                    const firstBaseline = y + 14;
                    nameLines.forEach((part, index) => {
                        drawText(part, x(), firstBaseline + index * itemLine, itemSize, true, 0.13);
                    });
                    if (firstSegment) {
                        const price = brl(item.price_cents);
                        drawText(price, right() - widthOf(price, itemSize), firstBaseline, itemSize, true, 0.14);
                    }
                    for (let index = 0; index < count; index++) {
                        drawText(
                            description[descriptionOffset + index],
                            x(),
                            firstBaseline + nameLines.length * itemLine + index * descriptionLine,
                            descriptionSize,
                            false,
                            0.42,
                        );
                    }
                    descriptionOffset += count;
                    y += baseHeight + count * descriptionLine;
                    firstSegment = false;
                    if (descriptionOffset < description.length) {
                        moveWithinCategory();
                    }
                } while (descriptionOffset < description.length);
            }
            y += sectionPadding;
        }

        if (categories.length === 0) {
            drawText("Nenhum produto disponível no cardápio.", LEFT, y + 10, 11, false, 0.4);
        }

        for (let index = 0; index < pages.length; index++) {
            commands = pages[index];
            drawLine(LEFT, 792, RIGHT, 792, 0.87);
            const number = `${index + 1} / ${pages.length}`;
            drawText(number, RIGHT - widthOf(number, 8.5), 809, 8.5, false, 0.4);
        }
        return pages;
    };

    // Preserve comfortable type when possible. Compress only menus exceeding two A4 pages.
    let pages = renderLayout({ columns: 1, compact: false });
    if (pages.length > 2) {
        const alternatives: Layout[] = [
            { columns: 1, compact: true },
            { columns: 2, compact: false },
            { columns: 2, compact: true },
        ];
        for (const layout of alternatives) {
            const trial = renderLayout(layout);
            if (trial.length < pages.length || trial.length <= 2) {
                pages = trial;
            }
            if (pages.length <= 2) break;
        }
    }

    // Object offsets refer to byte positions, not JavaScript string lengths.
    const objects: Buffer[] = [];
    const addObject = (value: string | Buffer) => {
        objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1"));
    };
    addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
    addObject(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);
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

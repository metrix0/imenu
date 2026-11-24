import QRCode from "qrcode";
import { elements, field } from "./sefaz";

export function danfePdf(xml: string) {
    const issuer = elements(xml, "emit")[0];
    const key = elements(xml, "infNFe")[0].getAttribute("Id")?.slice(3) ?? "";
    const protocol = elements(xml, "infProt")[0];
    const payment = elements(xml, "detPag")[0];
    const labels: Record<string, string> = { "01": "Dinheiro", "03": "Crédito", "04": "Débito", "17": "Pix", "20": "Pix" };
    const items = elements(xml, "det").flatMap(item => [
        `${field(item, "cProd").slice(0, 8)} ${field(item, "xProd")}`,
        `${Number(field(item, "qCom"))} ${field(item, "uCom")} x ${Number(field(item, "vUnCom")).toFixed(2)}   Total ${field(item, "vProd")}`,
    ]);
    const lines = [
        field(issuer, "xNome"), `CNPJ: ${field(issuer, "CNPJ")}  IE: ${field(issuer, "IE")}`,
        `${field(issuer, "xLgr")}, ${field(issuer, "nro")}, ${field(issuer, "xBairro")}`, `${field(issuer, "xMun")}/SP`,
        "", "DANFE NFC-e - Documento Auxiliar", "da Nota Fiscal de Consumidor Eletrônica",
        ...(field(elements(xml, "ide")[0], "tpAmb") === "2" ? ["HOMOLOGAÇÃO - SEM VALOR FISCAL"] : []),
        ...(protocol ? [] : ["EMITIDA EM CONTINGÊNCIA", "Pendente de autorização"]),
        "", "Código / descrição", "Qtd. Un. x valor unitário / total", ...items, "",
        `Desconto: R$ ${field(elements(xml, "ICMSTot")[0], "vDesc")}`,
        `Entrega: R$ ${field(elements(xml, "ICMSTot")[0], "vFrete")}`,
        `Valor a pagar: R$ ${field(elements(xml, "ICMSTot")[0], "vNF")}`,
        `${labels[field(payment, "tPag")] ?? "Pagamento"}: R$ ${field(payment, "vPag")}`, "",
        "Consulte pela chave em", field(elements(xml, "infNFeSupl")[0], "urlChave"),
        (key.match(/.{1,4}/g) ?? []).join(" "), "",
        "Consumidor não identificado",
        `NFC-e ${field(elements(xml, "ide")[0], "nNF")} Série ${field(elements(xml, "ide")[0], "serie")}`,
        `Emissão: ${field(elements(xml, "ide")[0], "dhEmi")}`,
        ...(protocol ? [`Protocolo: ${field(protocol, "nProt")}`, field(protocol, "dhRecbto")] : []),
    ].flatMap(line => line.match(/.{1,61}/g) ?? [""]);
    const matrix = QRCode.create(field(elements(xml, "infNFeSupl")[0], "qrCode"), { errorCorrectionLevel: "M" }).modules;
    const width = 226.77;
    const height = lines.length * 12 + 120;
    const scale = 82 / matrix.size;
    const origin = (width - 82) / 2;
    const commands = lines.map((line, index) => {
        const hex = Buffer.from(line, "latin1").toString("hex");
        return `BT /F1 8 Tf 10 ${height - 18 - index * 12} Td <${hex}> Tj ET`;
    });
    for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) {
            if (matrix.get(y, x)) commands.push(`${(origin + x * scale).toFixed(4)} ${(10 + (matrix.size - y - 1) * scale).toFixed(4)} ${scale.toFixed(4)} ${scale.toFixed(4)} re f`);
        }
    }
    const content = commands.join("\n");
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let document = "%PDF-1.4\n";
    const offsets = objects.map((object, index) => {
        const offset = document.length;
        document += `${index + 1} 0 obj\n${object}\nendobj\n`;
        return offset;
    });
    const xref = document.length;
    document += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(document);
}

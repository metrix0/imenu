import { createCipheriv, createDecipheriv, randomBytes, randomInt, sign, X509Certificate } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

const NF = "http://www.portalfiscal.inf.br/nfe";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const DS = "http://www.w3.org/2000/09/xmldsig#";
const serializer = new XMLSerializer();

export type FiscalTax = { ncm: string; cfop: string; csosn: string; origin: string; cest?: string };
export type FiscalAddress = { street: string; number: string; district: string; cityCode: string; city: string; cep: string };
export type Issuer = FiscalAddress & { cnpj: string; ie: string; name: string; series: number; defaultTax: FiscalTax; itemTaxes?: Record<string, FiscalTax> };
export type Sale = {
    items: { uuid: string; name: string; quantity: number; cents: number; tax: FiscalTax }[];
    deliveryCents: number; totalCents: number; payment: string; delivery: boolean;
    issuedAt: string;
};
type Identity = { key: string; cert: string; pfx: Buffer; password: string };
export type FiscalEnvironment = 1 | 2;
type XmlElement = ReturnType<DOMParser["parseFromString"]>["documentElement"];

export function fiscalEnvironment(): FiscalEnvironment | null {
    if (!/^[a-f0-9]{64}$/i.test(process.env.NFCE_KEY ?? "")) return null;
    if (process.env.NFCE_ENV === "homologacao") return 2;
    return process.env.NFCE_ENV === "producao" ? 1 : null;
}

export function certificateIdentity(pfx: Buffer, password: string): Identity {
    const asn = forge.asn1.fromDer(pfx.toString("binary"));
    const bundle = forge.pkcs12.pkcs12FromAsn1(asn, false, password);
    const key = bundle.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
    if (!key) throw new Error("O arquivo não contém uma chave privada A1.");
    const signer = forge.pki.privateKeyToPem(key);
    const leaves = bundle.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const cert = leaves.find(leaf => leaf.cert && leaf.cert.publicKey && "n" in leaf.cert.publicKey && "n" in key && leaf.cert.publicKey.n.equals(key.n))?.cert;
    if (!cert || cert.validity.notBefore.valueOf() > Date.now() || cert.validity.notAfter.valueOf() <= Date.now()) {
        throw new Error("Certificado A1 inválido ou vencido.");
    }
    return { key: signer, cert: forge.pki.certificateToPem(cert), pfx, password };
}

export function sealCertificate(restaurant: string, pfx: Buffer, password: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(process.env.NFCE_KEY!, "hex"), iv);
    cipher.setAAD(Buffer.from(restaurant));
    const data = Buffer.concat([cipher.update(JSON.stringify([pfx.toString("base64"), password])), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function readCertificate(restaurant: string, encrypted: string): Identity {
    const data = Buffer.from(encrypted, "base64");
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(process.env.NFCE_KEY!, "hex"), data.subarray(0, 12));
    decipher.setAAD(Buffer.from(restaurant));
    decipher.setAuthTag(data.subarray(12, 28));
    const [pfx, password] = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
    return certificateIdentity(Buffer.from(pfx, "base64"), password);
}

export function escapeXml(value: string | number): string {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function tag(name: string, value: string | number): string {
    return `<${name}>${escapeXml(value)}</${name}>`;
}

function parseXml(xml: string) {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML fiscal inválido.");
    return new DOMParser().parseFromString(xml, "text/xml");
}

function find(root: XmlElement | ReturnType<typeof parseXml>, name: string) {
    return root?.getElementsByTagNameNS("*", name).item(0) ?? null;
}

export function field(root: XmlElement | ReturnType<typeof parseXml>, name: string) {
    return find(root, name)?.textContent ?? "";
}

export function elements(xml: string, name: string) {
    return Array.from(parseXml(xml).getElementsByTagNameNS("*", name));
}

function signed(xml: string, element: string, identity: Identity) {
    const signer = new SignedXml({
        privateKey: identity.key, publicCert: identity.cert,
        signatureAlgorithm: DS + "rsa-sha1", canonicalizationAlgorithm: C14N,
        getKeyInfoContent: () => `<X509Data>${tag("X509Certificate", new X509Certificate(identity.cert).raw.toString("base64"))}</X509Data>`,
    });
    signer.addReference({ xpath: `//*[local-name(.)='${element}']`, transforms: [DS + "enveloped-signature", C14N], digestAlgorithm: DS + "sha1" });
    signer.computeSignature(xml);
    return signer.getSignedXml();
}

export const currency = (cents: number) => (cents / 100).toFixed(2);
const padded = (value: number, length: number) => String(value).padStart(length, "0");

export function controlDigit(base: string) {
    const total = [...base].reverse().reduce((sum, digit, index) => sum + Number(digit) * (2 + index % 8), 0);
    const digit = 11 - total % 11;
    return digit >= 10 ? 0 : digit;
}

function address(data: FiscalAddress) {
    return tag("xLgr", data.street) + tag("nro", data.number) + tag("xBairro", data.district)
        + tag("cMun", data.cityCode) + tag("xMun", data.city) + tag("UF", "SP") + (data.cep ? tag("CEP", data.cep) : "")
        + tag("cPais", "1058") + tag("xPais", "BRASIL");
}

function allocate(total: number, weights: number[]) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let through = 0;
    return weights.map(weight => {
        const before = Math.floor(through * total / sum);
        through += weight;
        return Math.floor(through * total / sum) - before;
    });
}

export function paymentCode(method: string) {
    const codes: Record<string, string> = { dinheiro: "01", cartao: "03", "credito-entrega": "03", "debito-entrega": "04", pix: "17", "pix-entrega": "20" };
    return codes[method] ?? null;
}

export function buildNote(issuer: Issuer, sale: Sale, identity: Identity, env: FiscalEnvironment, number: number, offline = false) {
    const type = offline ? 9 : 1;
    const random = padded(randomInt(1, 100_000_000), 8);
    const base = "35" + sale.issuedAt.slice(2, 7).replace("-", "") + issuer.cnpj + "65" + padded(issuer.series, 3) + padded(number, 9) + type + random;
    const digit = controlDigit(base);
    const key = base + digit;
    const payment = paymentCode(sale.payment);
    if (!payment) throw new Error("Informe a forma de pagamento da venda.");

    const values = sale.items.map(item => item.cents);
    const products = values.reduce((a, b) => a + b, 0);
    const discount = products + sale.deliveryCents - sale.totalCents;
    if (products <= 0 || sale.totalCents <= 0 || discount < 0 || discount > products) throw new Error("Os totais do pedido precisam de revisão fiscal.");
    const discounts = allocate(discount, values);
    const freight = allocate(sale.deliveryCents, values);
    const ide = tag("cUF", 35) + tag("cNF", random) + tag("natOp", "VENDA") + tag("mod", 65) + tag("serie", issuer.series)
        + tag("nNF", number) + tag("dhEmi", sale.issuedAt) + tag("tpNF", 1) + tag("idDest", 1) + tag("cMunFG", issuer.cityCode)
        + tag("tpImp", 4) + tag("tpEmis", type) + tag("cDV", digit) + tag("tpAmb", env) + tag("finNFe", 1) + tag("indFinal", 1)
        + tag("indPres", sale.delivery ? 4 : 1) + tag("indIntermed", 0) + tag("procEmi", 0) + tag("verProc", "iMenu 1.0")
        + (offline ? tag("dhCont", sale.issuedAt) + tag("xJust", "Indisponibilidade do autorizador SEFAZ") : "");
    const items = sale.items.map((item, index) => {
        const unit = (item.cents / item.quantity / 100).toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
        return `<det nItem="${index + 1}"><prod>${tag("cProd", item.uuid)}${tag("cEAN", "SEM GTIN")}${tag("xProd", env === 2 && index === 0 ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : item.name)}${tag("NCM", item.tax.ncm)}${item.tax.cest ? tag("CEST", item.tax.cest) : ""}${tag("CFOP", item.tax.cfop)}${tag("uCom", "UN")}${tag("qCom", item.quantity)}${tag("vUnCom", unit)}${tag("vProd", currency(item.cents))}${tag("cEANTrib", "SEM GTIN")}${tag("uTrib", "UN")}${tag("qTrib", item.quantity)}${tag("vUnTrib", unit)}${freight[index] ? tag("vFrete", currency(freight[index])) : ""}${discounts[index] ? tag("vDesc", currency(discounts[index])) : ""}${tag("indTot", 1)}</prod><imposto><ICMS><ICMSSN102>${tag("orig", item.tax.origin)}${tag("CSOSN", item.tax.csosn)}</ICMSSN102></ICMS></imposto></det>`;
    }).join("");
    const zero = (names: string[]) => names.map(name => tag(name, "0.00")).join("");
    const total = `<total><ICMSTot>${zero(["vBC", "vICMS", "vICMSDeson", "vFCP", "vBCST", "vST", "vFCPST", "vFCPSTRet"])}${tag("vProd", currency(products))}${tag("vFrete", currency(sale.deliveryCents))}${tag("vSeg", "0.00")}${tag("vDesc", currency(discount))}${zero(["vII", "vIPI", "vIPIDevol", "vPIS", "vCOFINS", "vOutro"])}${tag("vNF", currency(sale.totalCents))}</ICMSTot></total>`;
    let qr = [key, "3", env].join("|");
    if (offline) {
        qr = [qr, sale.issuedAt.slice(8, 10), currency(sale.totalCents), "", ""].join("|");
        qr += "|" + encodeURIComponent(sign("RSA-SHA1", Buffer.from(qr), identity.key).toString("base64"));
    }
    const { qrBase, lookup } = urls(env);
    const qrCode = qrBase + "?p=" + qr;
    const body = `<NFe xmlns="${NF}"><infNFe Id="NFe${key}" versao="4.00"><ide>${ide}</ide><emit>${tag("CNPJ", issuer.cnpj)}${tag("xNome", issuer.name)}<enderEmit>${address(issuer)}</enderEmit>${tag("IE", issuer.ie)}${tag("CRT", 1)}</emit>${items}${total}<transp>${tag("modFrete", sale.delivery ? 3 : 9)}</transp><pag><detPag>${tag("tPag", payment)}${tag("vPag", currency(sale.totalCents))}${["03", "04", "17", "20"].includes(payment) ? "<card><tpIntegra>2</tpIntegra></card>" : ""}</detPag></pag></infNFe><infNFeSupl>${tag("qrCode", qrCode)}${tag("urlChave", lookup)}</infNFeSupl></NFe>`;
    return { key, xml: signed(body, "infNFe", identity), qr: qrCode };
}

function urls(env: FiscalEnvironment) {
    const host = env === 2 ? "homologacao.nfce.fazenda.sp.gov.br" : "nfce.fazenda.sp.gov.br";
    return { host, qrBase: `https://${env === 2 ? host : "www." + host}/qrcode`, lookup: `https://${env === 2 ? host : "www." + host}/consulta` };
}

async function call(env: FiscalEnvironment, identity: Identity, service: string, method: string, payload: string): Promise<string> {
    const namespace = `${NF}/wsdl/${service}`;
    const soap = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="${namespace}">${payload}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
    return new Promise((resolve, reject) => {
        const req = httpsRequest({
            hostname: urls(env).host, path: `/ws/${service}.asmx`, method: "POST",
            pfx: identity.pfx, passphrase: identity.password, rejectUnauthorized: true,
            signal: AbortSignal.timeout(8_000),
            headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${namespace}/${method}"`, "Content-Length": Buffer.byteLength(soap) },
        }, res => {
            let data = "";
            res.setEncoding("utf8");
            res.on("data", part => {
                data += part;
                if (data.length > 524288) req.destroy(new Error("Resposta fiscal muito grande."));
            });
            res.on("error", reject);
            res.on("end", () => res.statusCode === 200 ? resolve(data) : reject(new Error(`SEFAZ HTTP ${res.statusCode}`)));
        });
        req.on("error", reject);
        req.end(soap);
    });
}

function response(xml: string, root: string, protocol: string) {
    const doc = parseXml(xml);
    const data = find(doc, root);
    if (!data) throw new Error("Não foi possível interpretar a resposta da SEFAZ.");
    const proc = find(data, protocol);
    const status = find(proc, "cStat") ?? Array.from(data.childNodes).find(node => node.nodeType === 1 && node.nodeName.split(":").pop() === "cStat");
    const detail = proc ?? data;
    return {
        code: status?.textContent ?? "", message: field(detail, "xMotivo"), key: field(detail, "chNFe"),
        number: field(detail, "nProt"), protocol: proc ? serializer.serializeToString(proc) : null,
    };
}

export async function sendNote(env: FiscalEnvironment, identity: Identity, number: number, xml: string) {
    return response(await call(env, identity, "NFeAutorizacao4", "nfeAutorizacaoLote", `<enviNFe xmlns="${NF}" versao="4.00">${tag("idLote", number)}${tag("indSinc", 1)}${xml}</enviNFe>`), "retEnviNFe", "protNFe");
}

export async function consultNote(env: FiscalEnvironment, identity: Identity, key: string) {
    return response(await call(env, identity, "NFeConsultaProtocolo4", "nfeConsultaNF", `<consSitNFe xmlns="${NF}" versao="4.00">${tag("tpAmb", env)}${tag("xServ", "CONSULTAR")}${tag("chNFe", key)}</consSitNFe>`), "retConsSitNFe", "protNFe");
}

export const authorizedXml = (xml: string, protocol: string) => `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="${NF}" versao="4.00">${xml}${protocol}</nfeProc>`;

export async function cancelNote(env: FiscalEnvironment, identity: Identity, issuer: Issuer, key: string, protocol: string, at: string, reason: string) {
    const event = signed(`<evento xmlns="${NF}" versao="1.00"><infEvento Id="ID110111${key}01">${tag("cOrgao", 35)}${tag("tpAmb", env)}${tag("CNPJ", issuer.cnpj)}${tag("chNFe", key)}${tag("dhEvento", at)}${tag("tpEvento", 110111)}${tag("nSeqEvento", 1)}${tag("verEvento", "1.00")}<detEvento versao="1.00">${tag("descEvento", "Cancelamento")}${tag("nProt", protocol)}${tag("xJust", reason)}</detEvento></infEvento></evento>`, "infEvento", identity);
    const data = response(await call(env, identity, "NFeRecepcaoEvento4", "nfeRecepcaoEventoNF", `<envEvento xmlns="${NF}" versao="1.00">${tag("idLote", 1)}${event}</envEvento>`), "retEnvEvento", "retEvento");
    return { ...data, xml: `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe xmlns="${NF}" versao="1.00">${event}${data.protocol ?? ""}</procEventoNFe>` };
}

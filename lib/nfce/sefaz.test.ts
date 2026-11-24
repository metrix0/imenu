import { EventEmitter } from "node:events";
import { request as httpsRequest } from "node:https";
import { gunzipSync, gzipSync } from "node:zlib";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
    authorizedXml, buildNote, certificateIdentity, controlDigit, elements, field, fiscalEnvironment,
    readCertificate, sealCertificate, sendNote, consultNote,
    type Issuer, type Sale,
} from "./sefaz";
import { danfePdf } from "./danfe";
import { parseFiscalDeliveryAddress } from "./service";

jest.mock("node:https", () => ({ request: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const address = { street: "Rua A", number: "10", district: "Centro", city: "São Paulo", cityCode: "3550308", cep: "01001000" };
const tax = { cfop: "5102", ncm: "21069090", csosn: "102", origin: "0" };
const issuer: Issuer = { ...address, cnpj: "11222333000181", ie: "110042490114", name: "Restaurante Exemplo", series: 1, defaultTax: tax };
const sale: Sale = {
    items: [{ uuid: "item-1", name: "Arroz & feijão", quantity: 3, cents: 1500, tax }, { uuid: "item-2", name: "Sobremesa", quantity: 1, cents: 505, tax }],
    issuedAt: "2026-11-22T15:40:00-03:00", deliveryCents: 200, totalCents: 2088,
    payment: "credito-entrega", delivery: false,
};

let identity: ReturnType<typeof certificateIdentity>;
beforeAll(() => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date(Date.now() - 60_000);
    cert.validity.notAfter = new Date(Date.now() + 60_000);
    const name = [{ name: "commonName", value: "Synthetic NFC-e Test" }];
    cert.setSubject(name);
    cert.setIssuer(name);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const pfx = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, "test-password", { algorithm: "3des" });
    identity = certificateIdentity(Buffer.from(forge.asn1.toDer(pfx).getBytes(), "binary"), "test-password");
});

test("signs the exact NFC-e payload and preserves it in the compressed authorized XML", () => {
    const note = buildNote(issuer, sale, identity, 2, 28);
    expect(note.key).toMatch(/^35261111222333000181650010000000281\d{9}$/);
    expect(+note.key.slice(-1)).toBe(controlDigit(note.key.slice(0, -1)));
    const doc = new DOMParser().parseFromString(note.xml, "text/xml");
    const signature = doc.getElementsByTagName("Signature").item(0)!;
    const verifier = new SignedXml({ publicCert: identity.cert });
    verifier.loadSignature(new XMLSerializer().serializeToString(signature));
    expect(verifier.checkSignature(note.xml)).toBe(true);
    expect(field(elements(note.xml, "ICMSTot")[0], "vDesc")).toBe("1.17");
    expect(field(elements(note.xml, "ICMSTot")[0], "vNF")).toBe("20.88");
    expect(note.qr).toContain(note.key + "|3|2");
    expect(elements(note.xml, "dest")).toHaveLength(0);
    const authorized = authorizedXml(note.xml, "<protNFe><infProt><nProt>123456</nProt></infProt></protNFe>");
    expect(gunzipSync(gzipSync(authorized)).toString()).toBe(authorized);
    expect(danfePdf(authorized).subarray(0, 8).toString()).toBe("%PDF-1.4");
});

test("adds the signed QR parameters for offline NFC-e", () => {
    const note = buildNote(issuer, sale, identity, 2, 29, true);
    expect(field(elements(note.xml, "ide")[0], "tpEmis")).toBe("9");
    expect(note.qr).toContain(note.key + "|3|2|22|20.88|||");
});

test("binds the certificate to its restaurant and requires explicit fiscal environment selection", () => {
    const previous = { key: process.env.NFCE_KEY, env: process.env.NFCE_ENV };
    try {
        process.env.NFCE_KEY = "a".repeat(64);
        process.env.NFCE_ENV = "production";
        expect(fiscalEnvironment()).toBeNull();
        process.env.NFCE_ENV = "producao";
        expect(fiscalEnvironment()).toBe(1);
        process.env.NFCE_ENV = "homologacao";
        expect(fiscalEnvironment()).toBe(2);
        const sealed = sealCertificate("restaurant-a", identity.pfx, identity.password);
        expect(readCertificate("restaurant-a", sealed).cert).toBe(identity.cert);
        expect(() => readCertificate("restaurant-b", sealed)).toThrow();
    } finally {
        if (previous.key === undefined) delete process.env.NFCE_KEY;
        else process.env.NFCE_KEY = previous.key;
        if (previous.env === undefined) delete process.env.NFCE_ENV;
        else process.env.NFCE_ENV = previous.env;
    }
});

test("exercises direct authorization and key-based recovery against a simulated SEFAZ transport", async () => {
    const note = buildNote(issuer, sale, identity, 2, 30);
    let requestBody = "";
    const mockSefaz = jest.mocked(httpsRequest);
    mockSefaz.mockImplementation((options, listener) => {
        const request = new EventEmitter();
        Object.assign(request, {
            end(body: string) {
                requestBody = body;
                const response = new EventEmitter();
                Object.assign(response, { statusCode: 200, setEncoding() {} });
                (listener as (data: typeof response) => void)(response);
                const action = String((options as unknown as { path: string }).path);
                const consultation = action.includes("Consulta");
                const tag = consultation ? "retConsSitNFe" : "retEnviNFe";
                const protocol = `<protNFe versao="4.00"><infProt><chNFe>${note.key}</chNFe><nProt>135260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protNFe>`;
                response.emit("data", `<${tag} xmlns="http://www.portalfiscal.inf.br/nfe"><cStat>${consultation ? 100 : 104}</cStat>${protocol}</${tag}>`);
                response.emit("end");
            },
        });
        return request as unknown as ReturnType<typeof httpsRequest>;
    });

    const authorized = await sendNote(2, identity, 30, note.xml);
    expect(authorized).toMatchObject({ code: "100", key: note.key, number: "135260000000001" });
    expect(mockSefaz).toHaveBeenLastCalledWith(expect.objectContaining({
        hostname: "homologacao.nfce.fazenda.sp.gov.br", path: "/ws/NFeAutorizacao4.asmx",
        pfx: identity.pfx, rejectUnauthorized: true,
    }), expect.any(Function));
    expect(requestBody).toContain(note.xml);

    const consulted = await consultNote(1, identity, note.key);
    expect(consulted).toMatchObject({ code: "100", key: note.key, number: authorized.number });
    expect(mockSefaz).toHaveBeenLastCalledWith(expect.objectContaining({
        hostname: "nfce.fazenda.sp.gov.br", path: "/ws/NFeConsultaProtocolo4.asmx",
    }), expect.any(Function));
    expect(requestBody).toContain(`<chNFe>${note.key}</chNFe>`);
});

test.each([
    ["Rua A, 10 - Centro - 01002-000", false, "01002000"],
    ["Rua A, 10, Centro, Sao Paulo - SP, 01002000, Brasil · Portão", false, "01002000"],
    ["Rua A, 10 - Centro", true, "01001000"],
    ["Rua A, 10, Centro, São Paulo - SP, , Brasil", true, "01001000"],
    ["Rua A, 10 - Centro", false, ""],
])("serializes the recipient address in the signed delivery XML for %s", (savedAddress, useCityCep, expectedCep) => {
    const recipientAddress = parseFiscalDeliveryAddress(savedAddress, issuer, useCityCep);
    expect(recipientAddress).not.toBeNull();
    const delivery = { ...sale, delivery: true, recipientAddress: recipientAddress! };
    const note = buildNote(issuer, delivery, identity, 2, 31);
    expect(field(elements(note.xml, "ide")[0], "indPres")).toBe("4");
    const destination = elements(note.xml, "dest");
    expect(destination).toHaveLength(1);
    expect(field(destination[0], "xLgr")).toBe("Rua A");
    expect(field(destination[0], "nro")).toBe("10");
    expect(field(destination[0], "xBairro")).toBe("Centro");
    expect(field(destination[0], "CEP")).toBe(expectedCep);
    expect(field(destination[0], "cMun")).toBe("3550308");
    expect(field(destination[0], "indIEDest")).toBe("9");
    expect(note.xml).not.toContain("<CPF>");
});

import { gunzipSync, gzipSync } from "node:zlib";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
    authorizedXml, buildNote, certificateIdentity, controlDigit, elements, field, fiscalEnvironment,
    readCertificate, sealCertificate,
    type Issuer, type Sale,
} from "./sefaz";
import { danfePdf } from "./danfe";

const address = { street: "Rua A", number: "10", district: "Centro", city: "São Paulo", cityCode: "3550308", cep: "01001000" };
const tax = { cfop: "5102", ncm: "21069090", csosn: "102", origin: "0" };
const issuer: Issuer = { ...address, cnpj: "11222333000181", ie: "110042490114", name: "Restaurante Exemplo", series: 1, defaultTax: tax };
const sale: Sale = {
    items: [{ uuid: "item-1", name: "Arroz & feijão", quantity: 3, cents: 1500, tax }, { uuid: "item-2", name: "Sobremesa", quantity: 1, cents: 505, tax }],
    issuedAt: "2026-11-22T15:40:00-03:00", deliveryCents: 200, totalCents: 2088,
    payment: "credito-entrega", delivery: true, recipient: { ...address, cpf: "12345678909", name: "Consumidor de Teste" },
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
    const authorized = authorizedXml(note.xml, "<protNFe><infProt><nProt>123456</nProt></infProt></protNFe>");
    expect(gunzipSync(gzipSync(authorized)).toString()).toBe(authorized);
    expect(danfePdf(authorized).subarray(0, 8).toString()).toBe("%PDF-1.4");
});

test("adds the signed QR parameters for offline NFC-e", () => {
    const note = buildNote(issuer, sale, identity, 2, 29, true);
    expect(field(elements(note.xml, "ide")[0], "tpEmis")).toBe("9");
    expect(note.qr).toContain(note.key + "|3|2|22|20.88|2|12345678909|");
});

test("keeps the certificate bound to its restaurant and production off", () => {
    const previous = { key: process.env.NFCE_KEY, env: process.env.NFCE_ENV };
    try {
        process.env.NFCE_KEY = "a".repeat(64);
        process.env.NFCE_ENV = "production";
        expect(fiscalEnvironment()).toBeNull();
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

import { activeFiscalIssuer, needsFiscalNote, parseFiscalDeliveryAddress } from "./service";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import type { Issuer } from "./sefaz";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
const issuer = {
    city: "Rio Claro", cityCode: "3543907", cep: "13500-000", cnpj: "11222333000181",
} as Issuer;

it("enables issuance only for an enabled issuer in the active environment with Plus", async () => {
    const originalEnv = process.env.NFCE_ENV;
    const originalKey = process.env.NFCE_KEY;
    try {
        process.env.NFCE_ENV = "producao";
        process.env.NFCE_KEY = "f".repeat(64);
        jest.mocked(query).mockResolvedValue({ rows: [{ data: issuer }], rowCount: 1 });
        jest.mocked(hasIMenuPlusAccess).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        await expect(activeFiscalIssuer("restaurant")).resolves.toBeNull();
        await expect(activeFiscalIssuer("restaurant")).resolves.toEqual({ environment: 1, data: issuer });
        expect(jest.mocked(query)).toHaveBeenCalledWith(expect.stringContaining("certificate IS NOT NULL"), ["restaurant", 1]);
    } finally {
        if (originalEnv === undefined) delete process.env.NFCE_ENV;
        else process.env.NFCE_ENV = originalEnv;
        if (originalKey === undefined) delete process.env.NFCE_KEY;
        else process.env.NFCE_KEY = originalKey;
    }
});

test("issues consumer notes only for eligible in-store orders without identification", () => {
    expect(needsFiscalNote("done", "retirada")).toBe(true);
    expect(needsFiscalNote("done", "balcao")).toBe(true);
    expect(needsFiscalNote("delivering", "entrega")).toBe(true);
    expect(needsFiscalNote("done", "entrega")).toBe(true);
});

test.each([
    "Rua das Flores, 123 - Centro - 13501-234 (Casa) - Referência: Praça, Brasil",
    "Rua das Flores, 123, Centro, rio claro - SP, 13501234, Brasil · Casa · Portão",
])("preserves delivery fields and the customer CEP in %s", address => {
    const expected = {
        street: "Rua das Flores", number: "123", district: "Centro", city: "Rio Claro", cityCode: "3543907", cep: "13501234",
    };
    expect(parseFiscalDeliveryAddress(address, issuer)).toEqual(expected);
    expect(parseFiscalDeliveryAddress(address, issuer, true)).toEqual(expected);
});

test.each([
    "Rua das Flores, 123 - Centro (Casa) - Referência: Portão",
    "Rua das Flores, 123, Centro, Rio Claro - SP, , Brasil · Casa · Portão",
])("uses the issuer's CEP only in small-city mode when %s omits it", address => {
    expect(parseFiscalDeliveryAddress(address, issuer)).toMatchObject({ number: "123", district: "Centro", cep: "" });
    expect(parseFiscalDeliveryAddress(address, issuer, true)).toMatchObject({ number: "123", district: "Centro", cep: "13500000" });
    expect(parseFiscalDeliveryAddress(address, { ...issuer, cep: "inválido" }, true)).toMatchObject({ cep: "" });
});

test.each([
    null,
    "Endereço incompleto",
    "Rua das Flores, 123, Centro, Limeira - SP, 13480000, Brasil",
    "Rua das Flores, 123, Centro, Rio Claro - RJ, 27460000, Brasil",
])("rejects an incomplete address or an unsupported delivery municipality: %s", address => {
    expect(parseFiscalDeliveryAddress(address, issuer, true)).toBeNull();
});

import { activeFiscalIssuer, checkoutRecipient } from "./service";
import { isValidFiscalCpf } from "./recipient";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import type { Issuer } from "./sefaz";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("@/lib/delivery/cnefe", () => ({ lookupSaoPauloMunicipality: jest.fn().mockResolvedValue("3526902") }));

const address = {
    rua: "Rua dos Testes", numero: "7", bairro: "Centro", cidade: "Rio Claro", estado: "SP", cep: "",
};
const issuer = {
    city: "Rio Claro", cityCode: "3543907", cnpj: "11222333000181",
} as Issuer;

it("validates and reuses a delivery address without requiring a ZIP in a small-city checkout", async () => {
    expect(isValidFiscalCpf("123.456.789-09")).toBe(true);
    expect(isValidFiscalCpf("000.000.000-00")).toBe(false);
    await expect(checkoutRecipient("123.456.789-09", "Pessoa Teste", address, issuer)).resolves.toEqual({
        cpf: "12345678909", name: "Pessoa Teste", street: address.rua, number: "7",
        district: "Centro", city: "Rio Claro", cep: "", cityCode: "3543907",
    });
    await expect(checkoutRecipient("123.456.789-09", "Pessoa Teste", { ...address, cidade: "Limeira" }, issuer))
        .resolves.toMatchObject({ city: "Limeira", cityCode: "3526902" });
    await expect(checkoutRecipient("12345678900", "Pessoa Teste", address, issuer)).rejects.toThrow(/CPF válido/);
    await expect(checkoutRecipient("12345678909", "Pessoa Teste", { ...address, estado: "MG" }, issuer)).rejects.toThrow(/São Paulo/);
});

it("exposes fiscal checkout only for an enabled issuer in the active environment with Plus", async () => {
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

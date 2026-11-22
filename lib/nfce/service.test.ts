import { activeFiscalIssuer } from "./service";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import type { Issuer } from "./sefaz";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
const issuer = {
    city: "Rio Claro", cityCode: "3543907", cnpj: "11222333000181",
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

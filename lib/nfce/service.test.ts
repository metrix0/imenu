import { activeFiscalIssuer, needsFiscalNote, parseFiscalDeliveryAddress, processNote, queueOrderNote } from "./service";
import { fiscalChannels, isFiscalChannelEnabled } from "./channels";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { consultNote, readCertificate, sendNote, type Issuer } from "./sefaz";
import type { PoolClient } from "pg";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("./sefaz", () => ({ ...jest.requireActual("./sefaz"), readCertificate: jest.fn(), consultNote: jest.fn(), sendNote: jest.fn() }));
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

test.each(["mesa", "balcao", "retirada"])("queues %s only at completion", type => {
    expect(needsFiscalNote("done", type)).toBe(true);
    expect(needsFiscalNote("delivering", type)).toBe(false);
});

test.each(["entrega", "delivery"])("supports %s at dispatch only when explicitly enabled", type => {
    expect(needsFiscalNote("delivering", type)).toBe(true);
    expect(needsFiscalNote("done", type)).toBe(true);
    expect(isFiscalChannelEnabled(fiscalChannels(), type)).toBe(false);
    expect(isFiscalChannelEnabled(fiscalChannels({ delivery: true }), type)).toBe(true);
});

test("the salon setting affects tables and counter independently of pickup", () => {
    const disabledSalon = fiscalChannels({ salon: false });
    expect(isFiscalChannelEnabled(disabledSalon, "mesa")).toBe(false);
    expect(isFiscalChannelEnabled(disabledSalon, "balcao")).toBe(false);
    expect(isFiscalChannelEnabled(disabledSalon, "retirada")).toBe(true);
    const disabledPickup = fiscalChannels({ pickup: false });
    expect(isFiscalChannelEnabled(disabledPickup, "mesa")).toBe(true);
    expect(isFiscalChannelEnabled(disabledPickup, "retirada")).toBe(false);
});

describe("issuance safeguards", () => {
    const oldEnvironment = process.env.NFCE_ENV;
    const oldKey = process.env.NFCE_KEY;
    beforeEach(() => {
        process.env.NFCE_ENV = "producao";
        process.env.NFCE_KEY = "f".repeat(64);
        jest.mocked(query).mockReset();
        jest.mocked(hasIMenuPlusAccess).mockResolvedValue(true);
    });
    afterEach(() => {
        if (oldEnvironment === undefined) delete process.env.NFCE_ENV;
        else process.env.NFCE_ENV = oldEnvironment;
        if (oldKey === undefined) delete process.env.NFCE_KEY;
        else process.env.NFCE_KEY = oldKey;
    });

    test("uses the stored delivery channel and encrypted CPF before queueing, and checks table payment", async () => {
        const client = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
        await expect(queueOrderNote(client as unknown as PoolClient, "restaurant", "order", "done", "entrega")).resolves.toBe(false);
        expect(client.query.mock.calls[0][0]).toContain("starts_with(fiscal.recipient_cpf_encrypted, i.environment::text || ':')");
        await expect(queueOrderNote(client as unknown as PoolClient, "restaurant", "order", "done", "mesa")).resolves.toBe(false);
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining("o.payment_method IS NOT NULL"), ["restaurant", "order", 1]);
        expect(client.query.mock.calls[0][0]).toContain("i.data->'channels'->>'salon' IS DISTINCT FROM 'false'");
    });

    test.each([["entrega", {}], ["retirada", { pickup: false }]])("does not send an unsigned %s job when its channel is disabled", async (type, flags) => {
        jest.mocked(query)
            .mockResolvedValueOnce({ rows: [{ restaurant_id: "restaurant", order_id: "order", attempt_token: "attempt" }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ enabled: true, certificate: "encrypted", data: { ...issuer, channels: fiscalChannels(flags) } }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ status: "done", is_delivery: type, payment_method: "dinheiro" }], rowCount: 1 })
            .mockResolvedValue({ rows: [], rowCount: 0 });
        await expect(processNote()).resolves.toBe(true);
        expect(sendNote).not.toHaveBeenCalled();
        expect(jest.mocked(query).mock.lastCall?.[1]).toEqual(["restaurant", "order", "attempt", "rejected", expect.stringContaining("Emissão de NFC-e"), null, null]);
    });

    test("checks a previously signed delivery note without CPF and does not send it again if SEFAZ has no record", async () => {
        jest.mocked(query)
            .mockResolvedValueOnce({ rows: [{ restaurant_id: "restaurant", order_id: "order", attempt_token: "attempt", signed_xml: Buffer.from("xml"), access_key: "key", sale: { delivery: true } }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ certificate: "encrypted", data: issuer }], rowCount: 1 })
            .mockResolvedValue({ rows: [], rowCount: 0 });
        jest.mocked(consultNote).mockResolvedValueOnce({ code: "217" } as Awaited<ReturnType<typeof consultNote>>);
        await expect(processNote()).resolves.toBe(true);
        expect(consultNote).toHaveBeenCalledWith(1, undefined, "key");
        expect(readCertificate).toHaveBeenCalledWith("restaurant", "encrypted");
        expect(sendNote).not.toHaveBeenCalled();
        expect(jest.mocked(query).mock.lastCall?.[1]?.[3]).toBe("rejected");
    });
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

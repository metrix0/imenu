import { generateKeyPairSync, verify } from "node:crypto";
import { query } from "@/lib/database/sql";
import { transferMercadoPagoToAsaas, isMercadoPagoPayoutComplete, reconcileMercadoPagoFunding } from "./mercadoPagoPayout";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
const keys = generateKeyPairSync("ed25519");
const reference = "imenu-mp-daily-payout-2026-09-30";
const transaction = { id: "TOP1", status: "success", status_detail: "accredited", amount: { currency: "BRL", value: 12.34 }, external_reference: `${reference}-asaas` };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let fetchMock: jest.SpyInstance;

beforeEach(() => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    process.env.MERCADO_PAGO_PAYOUT_PRIVATE_KEY = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    process.env.ASAAS_PIX_KEY = "test@example.com";
    process.env.ASAAS_PIX_KEY_TYPE = "email";
    fetchMock = jest.spyOn(global, "fetch");
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it("signs the exact production JSON, persists IDs before polling, and verifies the transaction", async () => {
    const onCreated = jest.fn(async () => undefined);
    fetchMock.mockResolvedValueOnce(reply({ id: "POP1", transactions: [{ id: "TOP1" }] }, 202));
    fetchMock.mockImplementationOnce(async () => {
        expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "POP1", transactionId: "TOP1" }));
        return reply(transaction);
    });
    const result = await transferMercadoPagoToAsaas({ amountCents: 1234, clientReference: reference, onCreated });
    expect(result?.transactionStatus).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/v1/payouts");
    expect(init.headers["X-enforce-signature"]).toBe("true");
    expect(init.headers["X-test-token"]).toBeUndefined();
    expect(verify(null, Buffer.from(init.body), keys.publicKey, Buffer.from(init.headers["X-signature"], "base64"))).toBe(true);
    expect(JSON.parse(init.body).transactions[0]).toMatchObject({ type: "pix", pix: { type: "EMAIL", chave: "test@example.com" }, amount: { value: 12.34, currency: "BRL" } });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.mercadopago.com/v1/payouts/POP1/transactions/TOP1");
});

it("retries transport failure with identical body and idempotency key", async () => {
    jest.useFakeTimers();
    fetchMock.mockRejectedValueOnce(new Error("connection lost"))
        .mockResolvedValueOnce(reply({ id: "POP1", transactions: [{ id: "TOP1" }] }, 202))
        .mockResolvedValueOnce(reply(transaction));
    const result = transferMercadoPagoToAsaas({ amountCents: 1234, clientReference: reference });
    await jest.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ transactionId: "TOP1" });
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[0][1].headers["X-Idempotency-Key"]).toBe(fetchMock.mock.calls[1][1].headers["X-Idempotency-Key"]);
});

it.each([NaN, -1, 0.5, 99])("rejects invalid/below-minimum amounts %s before network access", async value => {
    await expect(transferMercadoPagoToAsaas({ amountCents: value, clientReference: reference })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
});
it.each([["success", "in_progress"], ["approved", ""], ["processed", ""]])("does not treat %s/%s as settled", (status, detail) => {
    expect(isMercadoPagoPayoutComplete(status, detail)).toBe(false);
});
it("blocks mismatched transaction amounts", async () => {
    fetchMock.mockResolvedValueOnce(reply({ id: "POP1", transactions: [{ id: "TOP1" }] }, 202))
        .mockResolvedValueOnce(reply({ ...transaction, amount: { value: 99, currency: "BRL" } }));
    await expect(transferMercadoPagoToAsaas({ amountCents: 1234, clientReference: reference })).rejects.toThrow("divergente");
});
it("blocks new funding while an earlier accepted transfer remains in progress", async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: "old", payzu_transaction_id: "POP1/TOP1", transferred_cents: 1234, payzu_client_reference: reference }] });
    fetchMock.mockResolvedValueOnce(reply({ ...transaction, status_detail: "in_progress" }));
    await expect(reconcileMercadoPagoFunding("new")).rejects.toThrow("ainda pendente");
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

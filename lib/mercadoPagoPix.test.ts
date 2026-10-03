import { createMercadoPagoPixCharge, getMercadoPagoPixPayment } from "./mercadoPagoPix";
const payment = { id: 123, status: "approved", transaction_amount: 20, external_reference: "order1", payment_method_id: "pix", fee_details: [{ amount: 0.2, fee_payer: "collector" }, { amount: 1, fee_payer: "payer" }] };
afterEach(() => jest.restoreAllMocks());
it("uses actual collector fees and keeps payer fees separate", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(payment)));
    expect(await getMercadoPagoPixPayment({ id: "123" })).toMatchObject({ feeCents: 20, amount: 20 });
});
it("does not invent fees when the response omits fee details", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...payment, fee_details: undefined })));
    expect((await getMercadoPagoPixPayment({ id: "123" }))?.feeCents).toBeNull();
});
it("recovers a lost create response through an exact reference match", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(new Response(JSON.stringify({ results: [payment] })));
    expect(await createMercadoPagoPixCharge({ amount: 20, externalReference: "order1", idempotencyKey: "order1", notificationUrl: "https://example.com/webhook" })).toMatchObject({ id: "123" });
});

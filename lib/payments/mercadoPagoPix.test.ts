import { createMercadoPagoPixCharge, getMercadoPagoPixPayment, findMercadoPagoPixPaymentByReference } from "./mercadoPagoPix";
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

it("rejects malformed search responses instead of treating them as absent charges", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({})));
    await expect(findMercadoPagoPixPaymentByReference("order1")).rejects.toThrow("consulta Pix inválida");
});
it("only reports no charge after a valid empty search", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    expect(await findMercadoPagoPixPaymentByReference("order1")).toBeNull();
});


it("creates an exact R$1.64 Pix payment and returns its QR code without rounding", async () => {
    const reference = "ia-credits:c7f1e4a1-1111-4111-8111-122222222222:v1";
    const request = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
        id: 987654,
        status: "pending",
        transaction_amount: 1.64,
        external_reference: reference,
        payment_method_id: "pix",
        point_of_interaction: { transaction_data: {
            qr_code: "000201-mock-pix", qr_code_base64: "base64-qr"
        } },
    }), { status: 201 }));

    const result = await createMercadoPagoPixCharge({
        amount: 1.64,
        externalReference: reference,
        idempotencyKey: reference,
        notificationUrl: "https://imenu.example/api/webhooks/mercadopago",
        payerEmail: "owner@example.test",
    });
    expect(result).toMatchObject({
        id: "987654",
        amount: 1.64,
        status: "pending",
        qrCodeText: "000201-mock-pix",
        qrCodeBase64: "base64-qr",
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-Idempotency-Key"]).toBe(reference);
    const payload = JSON.parse(String(init?.body));
    expect(payload.transaction_amount).toBe(1.64);
    expect(payload.payment_method_id).toBe("pix");
    expect(payload.external_reference).toBe(reference);
});

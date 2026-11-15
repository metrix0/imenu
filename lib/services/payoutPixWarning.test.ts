import { EventEmitter } from "node:events";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import { query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";
import { notifyUpcomingPayoutPixProblem } from "./payoutNotifications";
import { warnAboutUpcomingPayoutPix } from "./payouts";

jest.mock("node:https", () => ({ request: jest.fn() }));
jest.mock("node:timers/promises", () => ({ setTimeout: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ getMercadoPagoPixPayment: jest.fn() }));
jest.mock("./payoutNotifications", () => ({ notifyUpcomingPayoutPixProblem: jest.fn() }));

const runAt = new Date("2026-11-16T02:20:00Z");

function restaurant(id: string, payment_info: string | null, payment_info_type: string | null) {
    return {
        restaurant_id: id, restaurant_name: id, payment_info, payment_info_type,
        payments: [{ id, payment_ref: "123", total_cents: 1000 }],
    };
}

function asaasResponse(statusCode: number, payload: unknown) {
    (request as jest.Mock).mockImplementationOnce((_url, _options, onResponse) => {
        const response = Object.assign(new EventEmitter(), { statusCode });
        const outgoing = Object.assign(new EventEmitter(), {
            end() {
                onResponse(response);
                response.emit("data", JSON.stringify(payload));
                response.emit("end");
            },
        });
        return outgoing;
    });
}

beforeEach(() => {
    jest.resetAllMocks();
    process.env.ASAAS_API_KEY = "test-only";
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async () => ({
        id: "123", paymentMethodId: "pix", amount: 10, status: "approved", feeCents: 1,
        externalReference: (getMercadoPagoPixPayment as jest.Mock).mock.calls.length.toString(),
    }));
    (notifyUpcomingPayoutPixProblem as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
    delete process.env.ASAAS_API_KEY;
});

test("warns only verified payables with missing key, missing type, invalid format or a rejected lookup", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [
        restaurant("1", null, null),
        restaurant("2", "pix@example.com", null),
        restaurant("3", "pix@example.com", "PHONE"),
        restaurant("4", "inactive@example.com", "EMAIL"),
        restaurant("5", "(19) 99999-9999", "PHONE"),
        restaurant("unverified", null, null),
    ] });
    asaasResponse(200, { remaining: 40 });
    asaasResponse(400, { errors: [{ description: "Chave Pix não encontrada." }] });
    asaasResponse(200, { key: "+5519999999999" });

    await expect(warnAboutUpcomingPayoutPix(runAt)).resolves.toEqual({
        eligible: 5, invalid: 4, sent: 4, uncheckedKeys: 0, unverifiedPayments: 1,
    });
    expect(notifyUpcomingPayoutPixProblem).toHaveBeenCalledTimes(4);
    for (const id of ["1", "2", "3", "4"]) {
        expect(notifyUpcomingPayoutPixProblem).toHaveBeenCalledWith(id, "2026-11-15");
    }
    expect((request as jest.Mock).mock.calls.map(([url, options]) => [url.pathname, url.searchParams.get("key"), options.method])).toEqual([
        ["/v3/pix/tokenBucket/addressKey", null, "GET"],
        ["/v3/pix/addressKeys/external", "inactive@example.com", "GET"],
        ["/v3/pix/addressKeys/external", "+5519999999999", "GET"],
    ]);
    expect(delay).toHaveBeenCalledWith(15_000);
});

test.each([429, 500])("an Asaas HTTP %s leaves the key unverified and sends no warning", async status => {
    (query as jest.Mock).mockResolvedValue({ rows: [restaurant("1", "pix@example.com", "EMAIL")] });
    asaasResponse(200, { remaining: 40 });
    asaasResponse(status, { errors: [{ description: "Chave Pix não encontrada." }] });

    await expect(warnAboutUpcomingPayoutPix(runAt)).resolves.toMatchObject({ uncheckedKeys: 1, sent: 0 });
    expect(notifyUpcomingPayoutPixProblem).not.toHaveBeenCalled();
});

test("skips external lookup when Asaas has insufficient tokens", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [restaurant("1", "pix@example.com", "EMAIL")] });
    asaasResponse(200, { remaining: 14 });

    await expect(warnAboutUpcomingPayoutPix(runAt)).resolves.toMatchObject({ uncheckedKeys: 1, sent: 0 });
    expect(request).toHaveBeenCalledTimes(1);
});

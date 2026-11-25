import { query } from "@/lib/database/sql";
import { checkWahaPhoneExists, sendWahaText } from "@/lib/services/wahaClient";
import { sendAddonPurchaseWhatsApp } from "./addonPurchaseWhatsApp";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({
    checkWahaPhoneExists: jest.fn(),
    sendWahaText: jest.fn(),
}));

const input = { addonId: "addon", paymentId: "payment" };
const session = "support";
let addon: Record<string, unknown>;
let claimed: boolean;

beforeEach(() => {
    jest.resetAllMocks();
    claimed = false;
    addon = {
        restaurant_id: "restaurant",
        product_key: "ia_plus",
        owner_phone: null,
        restaurant_phone: null,
        store_whatsapp: null,
        successful_payments: 1,
        current_payment_confirmed: true,
    };
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("FROM public.restaurant_addons AS addon")) return { rows: [addon] };
        if (sql.includes("INSERT INTO public.whatsapp_outbound_messages")) {
            if (claimed) return { rowCount: 0 };
            claimed = true;
            return { rowCount: 1 };
        }
        if (sql.includes("FROM public.support_whatsapp_connection")) return { rows: [{ session_name: session }] };
        return { rowCount: 1 };
    });
    (checkWahaPhoneExists as jest.Mock).mockResolvedValue({ numberExists: true, chatId: null });
    (sendWahaText as jest.Mock).mockResolvedValue({});
});

test("rejects a truncated international number instead of adding another country code", async () => {
    addon.owner_phone = "55169928479";
    addon.restaurant_phone = "16992847940";
    await sendAddonPurchaseWhatsApp(input);
    expect(checkWahaPhoneExists).toHaveBeenCalledTimes(1);
    expect(checkWahaPhoneExists).toHaveBeenCalledWith(session, "5516992847940");
    expect(sendWahaText).toHaveBeenCalledWith(session, "5516992847940@c.us", expect.any(String));
});

test("uses store WhatsApp if the owner and restaurant phones are missing", async () => {
    addon.restaurant_phone = "";
    addon.store_whatsapp = "11964641082";
    await sendAddonPurchaseWhatsApp(input);
    expect(checkWahaPhoneExists).toHaveBeenCalledWith(session, "5511964641082");
    expect(sendWahaText).toHaveBeenCalledWith(session, "5511964641082@c.us", expect.any(String));
});

test("falls back when earlier candidates do not exist and skips duplicate numbers", async () => {
    addon.owner_phone = "+55 (19) 99999-9999";
    addon.restaurant_phone = "19999999999";
    addon.store_whatsapp = "11964641082";
    (checkWahaPhoneExists as jest.Mock).mockResolvedValueOnce({ numberExists: false, chatId: null })
        .mockResolvedValueOnce({ numberExists: true, chatId: "valid@lid" });
    await sendAddonPurchaseWhatsApp(input);
    expect(checkWahaPhoneExists).toHaveBeenCalledTimes(2);
    expect(checkWahaPhoneExists).toHaveBeenNthCalledWith(1, session, "5519999999999");
    expect(checkWahaPhoneExists).toHaveBeenNthCalledWith(2, session, "5511964641082");
    expect(sendWahaText).toHaveBeenCalledWith(session, "valid@lid", expect.any(String));
});

test("preserves legitimate local DDD 55 and the owner-first priority", async () => {
    addon.owner_phone = "(55) 99999-9999";
    addon.restaurant_phone = "11964641082";
    addon.store_whatsapp = "19999999999";
    await sendAddonPurchaseWhatsApp(input);
    expect(checkWahaPhoneExists).toHaveBeenCalledTimes(1);
    expect(checkWahaPhoneExists).toHaveBeenCalledWith(session, "5555999999999");
});

test("does not send twice for the same purchase", async () => {
    addon.store_whatsapp = "11964641082";
    await Promise.all([sendAddonPurchaseWhatsApp(input), sendAddonPurchaseWhatsApp(input)]);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
});

test("does not fall back after an uncertain send failure", async () => {
    addon.owner_phone = "19999999999";
    addon.store_whatsapp = "11964641082";
    (sendWahaText as jest.Mock).mockRejectedValueOnce(new Error("timeout"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        await sendAddonPurchaseWhatsApp(input);
        expect(checkWahaPhoneExists).toHaveBeenCalledTimes(1);
        expect(sendWahaText).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"), ["support:addon-purchase:addon", "timeout"]);
    } finally {
        error.mockRestore();
    }
});

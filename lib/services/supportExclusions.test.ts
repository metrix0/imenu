import { query } from "@/lib/database/sql";
import { isSupportContactExcluded, normalizeSupportBlacklistPhone, getSupportBlacklist, addSupportBlacklistPhone, removeSupportBlacklistPhone } from "./supportExclusions";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test("normalizes national, international and old mobile formats", () => {
    expect(normalizeSupportBlacklistPhone("+55 11 99123-4567")).toBe("5511991234567");
    expect(normalizeSupportBlacklistPhone("0055 11 99123-4567")).toBe("5511991234567");
    expect(normalizeSupportBlacklistPhone("11 9123-4567")).toBe("5511991234567");
    expect(normalizeSupportBlacklistPhone("123")).toBeNull();
});

test("matches a plain phone or WhatsApp phone chat ID", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 });
    await expect(isSupportContactExcluded({ chatId: "imenu-blast:5511991234567@c.us" })).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM support_blacklist"), [["5511991234567"]]);
    await expect(isSupportContactExcluded({ phone: "11 9123-4567", chatId: "123456789@lid" })).resolves.toBe(true);
});

test("other contacts are unaffected and unresolved IDs do not query", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(isSupportContactExcluded({ phone: "5511999991234" })).resolves.toBe(false);
    await expect(isSupportContactExcluded({ chatId: "123456789@lid" })).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
});

test("lists, inserts and deletes plain phone numbers", async () => {
    const contacts = [{ phone: "5511991234567", created_at: "2026-11-28" }];
    (query as jest.Mock).mockResolvedValue({ rows: contacts, rowCount: 1 });
    await expect(getSupportBlacklist()).resolves.toEqual({ contacts });
    await addSupportBlacklistPhone(contacts[0].phone);
    await removeSupportBlacklistPhone(contacts[0].phone);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO support_blacklist (phone)"), [contacts[0].phone]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM support_blacklist"), [contacts[0].phone]);
});

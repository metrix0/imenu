import {
    parseRange, toTimestamp, normalizePhone, ordersInside, distinctAccountSet,
    accountsWithMinPurchaseDays, isHandledOrder, customerQualifiedAccounts,
} from "../dashboardMetrics";

const order = (accountId: string, status: string, customerKey: string | null, createdAt: number) =>
    ({ accountId, status, customerKey, createdAt });

describe("shared dashboard metrics", () => {
    it("preserves date-range defaults and timestamps", () => {
        expect(parseRange("90d")).toBe("90d");
        expect(parseRange("invalid")).toBe("7d");
        expect(parseRange(null)).toBe("7d");
        expect(toTimestamp("2026-10-01T12:00:00.000Z"))
            .toBe(new Date("2026-10-01T12:00:00.000Z").getTime());
    });
    it("preserves Brazilian-phone normalization", () => {
        expect(normalizePhone("+55 (19) 99999-8888")).toBe("19999998888");
        expect(normalizePhone("123")).toBeNull();
    });
    it("uses half-open windows and unique account IDs", () => {
        const orders = [order("A", "done", "1", 100), order("A", "done", "2", 101), order("B", "done", "3", 102)];
        const filtered = ordersInside(orders, 100, 102);
        expect(filtered).toHaveLength(2);
        expect([...distinctAccountSet(filtered)]).toEqual(["A"]);
    });
    it("counts local purchase days, ignoring non-done orders", () => {
        const orders = [
            order("A", "done", "1", Date.parse("2026-10-01T12:00:00Z")),
            order("A", "done", "1", Date.parse("2026-10-01T13:00:00Z")),
            order("A", "done", "1", Date.parse("2026-10-02T12:00:00Z")),
            order("B", "canceled", "2", Date.parse("2026-10-02T12:00:00Z")),
        ];
        expect([...accountsWithMinPurchaseDays(orders, 2)]).toEqual(["A"]);
    });
    it("requires four handled orders with four distinct customers", () => {
        const valid = ["1", "2", "3", "4"].map((customer, i) => order("A", "done", customer, i));
        const invalid = ["1", "2", "3", "4"].map((customer, i) => order("B", "pending_online_payment", customer, i));
        expect(isHandledOrder(invalid[0])).toBe(false);
        expect([...customerQualifiedAccounts([...valid, ...invalid])]).toEqual(["A"]);
    });
});

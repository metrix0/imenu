export const RANGE_KEYS = ["7d", "this_week", "last_week", "30d", "90d"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

type MetricOrder = { accountId: string; status: string; customerKey: string | null; createdAt: number };

export function parseRange(value: string | null): RangeKey {
    return RANGE_KEYS.includes(value as RangeKey)
        ? (value as RangeKey)
        : "7d";
}

export function toTimestamp(value: string | Date): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function normalizePhone(value: string | null): string | null {
    let digits = String(value || "").replace(/\D/g, "");

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
    }

    return digits.length >= 10 ? digits : null;
}

export function ordersInside<T extends MetricOrder>(
    orders: T[],
    start: number,
    end: number
): T[] {
    return orders.filter((order) => order.createdAt >= start && order.createdAt < end);
}

export function distinctAccountSet(orders: MetricOrder[]): Set<string> {
    return new Set(orders.map((order) => order.accountId));
}

const PURCHASE_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function purchaseDayKey(timestamp: number): string {
    return PURCHASE_DAY_FORMATTER.format(new Date(timestamp));
}

export function accountsWithMinPurchaseDays(
    orders: MetricOrder[],
    minimumDays: number
): Set<string> {
    const daysByAccount = new Map<string, Set<string>>();

    for (const order of orders) {
        if (order.status !== "done") continue;
        const days = daysByAccount.get(order.accountId) || new Set<string>();
        days.add(purchaseDayKey(order.createdAt));
        daysByAccount.set(order.accountId, days);
    }

    return new Set(
        [...daysByAccount.entries()]
            .filter(([, days]) => days.size >= minimumDays)
            .map(([accountId]) => accountId)
    );
}

export function isHandledOrder(order: MetricOrder): boolean {
    return order.status !== "canceled" && order.status !== "pending_online_payment";
}

export function customerQualifiedAccounts(orders: MetricOrder[]): Set<string> {
    const groups = new Map<string, { count: number; clients: Set<string> }>();

    for (const order of orders) {
        if (!isHandledOrder(order) || !order.customerKey) continue;
        const group = groups.get(order.accountId) || {
            count: 0,
            clients: new Set<string>(),
        };
        group.count += 1;
        group.clients.add(order.customerKey);
        groups.set(order.accountId, group);
    }

    return new Set(
        [...groups.entries()]
            .filter(([, group]) => group.count >= 4 && group.clients.size >= 4)
            .map(([accountId]) => accountId)
    );
}

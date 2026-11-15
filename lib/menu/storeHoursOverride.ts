const brazilDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
const brazilHour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23",
});

export function nextStoreMidnight(now: Date): string {
    const date = new Date(brazilDate.format(now) + "T00:00:00-03:00");
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
}

export function isManualOpeningActive(until: string | null | undefined, now: Date): boolean {
    return Boolean(until && Date.parse(until) > now.getTime());
}

export function isStoreManuallyClosed(closedAt: string | null | undefined, now: Date): boolean {
    if (!closedAt) return false;
    // The legacy timestamp column stores UTC without an offset.
    const date = new Date(/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(closedAt) ? closedAt + "Z" : closedAt);
    if (!Number.isFinite(date.getTime())) return false;
    const closedDay = brazilDate.format(date);
    return closedDay === brazilDate.format(now) ||
        (Number(brazilHour.format(now)) < 4 && closedDay === brazilDate.format(new Date(now.getTime() - 4 * 60 * 60_000)));
}


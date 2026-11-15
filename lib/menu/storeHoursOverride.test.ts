import { isManualOpeningActive, isStoreManuallyClosed, nextStoreMidnight } from "./storeHoursOverride";

test.each([
    ["2026-11-15T22:00:00Z", "2026-11-16T03:00:00.000Z"],
    ["2026-11-16T02:59:58Z", "2026-11-16T03:00:00.000Z"],
    ["2026-11-16T03:00:00Z", "2026-11-17T03:00:00.000Z"],
    ["2026-12-31T22:00:00Z", "2027-01-01T03:00:00.000Z"],
])("manual opening expires at the next Brasília midnight for %s", (start, expected) => {
    const opening = nextStoreMidnight(new Date(start));
    expect(opening).toBe(expected);
    expect(isManualOpeningActive(opening, new Date(start))).toBe(true);
    expect(isManualOpeningActive(opening, new Date(expected))).toBe(false);
});

test("null, malformed and expired overrides are inactive", () => {
    const now = new Date("2026-11-16T16:00:00Z");
    for (const value of [null, undefined, "invalid", "2026-11-16T03:00:00Z"]) {
        expect(isManualOpeningActive(value, now)).toBe(false);
    }
});

test("keeps an existing manual closure through the local 4am cutoff", () => {
    const closedAt = "2026-11-16T01:00:00.000";
    expect(isStoreManuallyClosed(closedAt, new Date("2026-11-16T02:00:00Z"))).toBe(true);
    expect(isStoreManuallyClosed(closedAt, new Date("2026-11-16T06:59:59Z"))).toBe(true);
    expect(isStoreManuallyClosed(closedAt, new Date("2026-11-16T07:00:00Z"))).toBe(false);
    expect(isStoreManuallyClosed(null, new Date("2026-11-16T02:00:00Z"))).toBe(false);
});


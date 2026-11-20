import { getOrderScheduleOptions, getSameDayOrderEarliestAt, hasOrderHours } from "./orderAvailability";

const today = "2026-11-15";
const now = new Date(today + "T18:00:00-03:00");
const tomorrow = "2026-11-16";

test("an empty calendar never exposes a bookable time", () => {
    expect(hasOrderHours({ 0: [], 1: [] })).toBe(false);
    expect(getOrderScheduleOptions({}, tomorrow, now)).toEqual([]);
});

test("after today's hours expire, the next scheduled day still has bookable times", () => {
    const hours = {
        0: [{ open: "12:00", close: "15:00" }],
        1: [{ open: "18:00", close: "19:00" }],
    };

    expect(hasOrderHours(hours)).toBe(true);
    expect(getOrderScheduleOptions(hours, today, now)).toEqual([]);
    expect(getOrderScheduleOptions(hours, tomorrow, now)).toHaveLength(5);
});

test("a manual closure applies today and allows scheduled times tomorrow", () => {
    const hours = {
        0: [{ open: "19:00", close: "20:00" }],
        1: [{ open: "19:00", close: "20:00" }],
    };

    expect(getOrderScheduleOptions(hours, today, now)).toHaveLength(5);
    expect(getOrderScheduleOptions(hours, today, now, true)).toEqual([]);
    expect(getOrderScheduleOptions(hours, tomorrow, now, true)).toHaveLength(5);
});

const deliveryHours = {
    0: [{ open: "12:00", close: "22:00" }],
    1: [{ open: "12:00", close: "22:00" }],
};
const deliverySettings = {
    availability_json: deliveryHours,
    delivery_fee_json: [{ time_minutes: 30 }, { time_minutes: 60 }],
};

test("an open store starts today's schedule at its longest delivery time", () => {
    const time = new Date(today + "T13:00:30-03:00");
    const earliest = getSameDayOrderEarliestAt(deliverySettings, time);
    expect(getOrderScheduleOptions(deliveryHours, today, time, false, earliest)[0]).toEqual({
        value: "2026-11-15T17:00:00.000Z",
        label: "14:00",
    });
    expect(getOrderScheduleOptions(deliveryHours, tomorrow, time, false, earliest)[0].label).toBe("12:00");
});

test("a deadline between slots rounds up to the next available quarter-hour", () => {
    const time = new Date(today + "T13:07:00-03:00");
    const earliest = getSameDayOrderEarliestAt(deliverySettings, time);
    expect(getOrderScheduleOptions(deliveryHours, today, time, false, earliest)[0].label).toBe("14:15");
});

test("a lead time that would run past closing leaves no same-day slots", () => {
    const time = new Date(today + "T21:30:00-03:00");
    const earliest = getSameDayOrderEarliestAt(deliverySettings, time);
    expect(getOrderScheduleOptions(deliveryHours, today, time, false, earliest)).toEqual([]);
});

test("a closed or preorder-only store does not add the delivery lead time", () => {
    const time = new Date(today + "T11:30:00-03:00");
    expect(getSameDayOrderEarliestAt(deliverySettings, time)).toBeNull();
    expect(getSameDayOrderEarliestAt({ ...deliverySettings, preorder_only: true }, now)).toBeNull();
    expect(getSameDayOrderEarliestAt({ ...deliverySettings, is_closed: "2026-11-15T12:00:00Z" }, now)).toBeNull();
    expect(getOrderScheduleOptions(deliveryHours, today, time)[0].label).toBe("12:00");
});

test("uses neighborhood times for a manually opened store", () => {
    const time = new Date(today + "T11:30:00-03:00");
    const earliest = getSameDayOrderEarliestAt({
        ...deliverySettings,
        manual_open_until: "2026-11-15T17:00:00Z",
        delivery_fee_mode: "neighborhood",
        delivery_neighborhood_fee_json: [{ neighborhood: "Centro", fee_cents: 500, time_minutes: 90 }],
    }, time);
    expect(earliest).toBe(new Date(today + "T13:00:00-03:00").getTime());
});

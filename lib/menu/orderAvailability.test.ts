import { getOrderScheduleOptions, hasOrderHours } from "./orderAvailability";

const now = new Date(2026, 10, 15, 18, 0);
const tomorrow = new Date(2026, 10, 16, 12, 0);

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
    expect(getOrderScheduleOptions(hours, now, now)).toEqual([]);
    expect(getOrderScheduleOptions(hours, tomorrow, now)).toHaveLength(5);
});

test("a manual closure applies today and allows scheduled times tomorrow", () => {
    const hours = {
        0: [{ open: "19:00", close: "20:00" }],
        1: [{ open: "19:00", close: "20:00" }],
    };

    expect(getOrderScheduleOptions(hours, now, now)).toHaveLength(5);
    expect(getOrderScheduleOptions(hours, now, now, true)).toEqual([]);
    expect(getOrderScheduleOptions(hours, tomorrow, now, true)).toHaveLength(5);
});

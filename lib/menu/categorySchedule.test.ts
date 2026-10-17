import { categoryScheduleLabel, isCategoryAvailable, validateCategorySchedule, type CategorySchedule } from "./categorySchedule";

const instant = (value: string) => new Date(value);

describe("category scheduling", () => {
    const monday = instant("2026-10-19T15:00:00Z"); // 12:00 Brasília
    test("unscheduled categories remain visible", () => {
        expect(isCategoryAvailable(null, monday)).toBe(true);
        expect(validateCategorySchedule(null)).toBeNull();
    });
    test("days-only and time-only restrictions work", () => {
        const workdays: CategorySchedule = [{ days: [1, 2, 3, 4, 5], start: null, end: null }];
        const lunch: CategorySchedule = [{ days: [], start: "11:00", end: "14:00" }];
        expect(isCategoryAvailable(workdays, monday)).toBe(true);
        expect(isCategoryAvailable(workdays, instant("2026-10-18T15:00:00Z"))).toBe(false);
        expect(isCategoryAvailable(lunch, monday)).toBe(true);
        expect(isCategoryAvailable(lunch, instant("2026-10-19T18:00:00Z"))).toBe(false);
    });
    test("multiple periods and overnight rules use Brasília time", () => {
        const schedule: CategorySchedule = [
            { days: [5], start: "20:00", end: "02:00" },
            { days: [1], start: "11:00", end: "14:00" },
        ];
        expect(isCategoryAvailable(schedule, monday)).toBe(true);
        expect(isCategoryAvailable(schedule, instant("2026-10-24T04:00:00Z"))).toBe(true);
        expect(isCategoryAvailable(schedule, instant("2026-10-24T06:00:00Z"))).toBe(false);
        expect(categoryScheduleLabel(schedule)).toContain("(+1)");
    });
    test("rejects ineffective schedules and identical hours", () => {
        expect(validateCategorySchedule([{ days: [], start: null, end: null }])).not.toBeNull();
        expect(validateCategorySchedule([{ days: [1], start: "11:00", end: "11:00" }])).not.toBeNull();
    });
});

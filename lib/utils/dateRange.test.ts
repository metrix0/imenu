import { shiftDateRange } from "./dateRange";

describe("shiftDateRange", () => {
    test("preserves the selected window when moving back seven days", () => {
        expect(shiftDateRange({ startDate: "2026-11-04", endDate: "2026-11-10" }, 7)).toEqual({
            startDate: "2026-10-28", endDate: "2026-11-03",
        });
    });

    test("crosses leap-year month boundaries correctly", () => {
        expect(shiftDateRange({ startDate: "2024-03-01", endDate: "2024-03-07" }, 7)).toEqual({
            startDate: "2024-02-23", endDate: "2024-02-29",
        });
    });

    test("undoes the shifted window", () => {
        const original = { startDate: "2026-11-04", endDate: "2026-11-10" };
        expect(shiftDateRange(shiftDateRange(original, 7), -7)).toEqual(original);
    });
});

import { isPlusOrderMilestoneEligible } from "../OrderMilestonePlusPopup";

jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));

test.each([
    [null, false, false],
    [0, false, false],
    [14, false, false],
    [15, false, true],
    [18, false, true],
    [20, false, true],
    [21, false, false],
    [15, true, false],
    [20, true, false],
] as const)("milestone eligibility: %s completed, Plus=%s", (orders, plus, expected) => {
    expect(isPlusOrderMilestoneEligible(orders, plus)).toBe(expected);
});

import {
    calculateOnePercentPayout,
    getMaxPayoutDifferenceCents,
    isSafePayoutDifference,
} from "./payoutSafety";

describe("payout safety", () => {
    it("keeps actual provider fee plus discount at exactly one percent after cent rounding", () => {
        const result = calculateOnePercentPayout(12_345, 70);

        expect(result.payzuFeeCents + result.discountCents).toBe(123);
        expect(result.netCents).toBe(12_222);
    });

    it("preserves the restaurant 1% deduction even when actual gateway fees exceed it", () => {
        const result = calculateOnePercentPayout(10_000, 119);
        expect(result).toEqual({ payzuFeeCents: 119, discountCents: -19, netCents: 9_900 });
    });

    it.each([-300, -1, 0, 1_000])(
        "accepts the inclusive safe difference %i cents",
        (differenceCents) => {
            expect(isSafePayoutDifference(differenceCents, 100_000)).toBe(true);
        }
    );

    it.each([-301, 1_001])(
        "blocks the out-of-range difference %i cents",
        (differenceCents) => {
            expect(isSafePayoutDifference(differenceCents, 100_000)).toBe(false);
        }
    );

    it("uses one percent of the total payout as the positive limit", () => {
        expect(getMaxPayoutDifferenceCents(250_000)).toBe(2_500);
        expect(isSafePayoutDifference(2_500, 250_000)).toBe(true);
        expect(isSafePayoutDifference(2_501, 250_000)).toBe(false);
    });
});

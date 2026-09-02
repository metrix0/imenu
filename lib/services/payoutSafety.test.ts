import {
    calculateOnePercentPayout,
    isSafePayoutDifference,
} from "./payoutSafety";

describe("payout safety", () => {
    it("keeps PayZu fee plus discount at exactly one percent after cent rounding", () => {
        const result = calculateOnePercentPayout(12_345, 7);

        expect(result.payzuFeeCents + result.discountCents).toBe(123);
        expect(result.netCents).toBe(12_222);
    });

    it.each([-300, -1, 0, 1_000])(
        "accepts the inclusive safe difference %i cents",
        (differenceCents) => {
            expect(isSafePayoutDifference(differenceCents)).toBe(true);
        }
    );

    it.each([-301, 1_001])(
        "blocks the out-of-range difference %i cents",
        (differenceCents) => {
            expect(isSafePayoutDifference(differenceCents)).toBe(false);
        }
    );
});

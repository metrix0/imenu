import {
    calculateOnePercentPayout,
    getMaxPayoutDifferenceCents,
    isSafePayoutDifference,
    summarizeOnePercentPayouts,
} from "./payoutSafety";

describe("payout safety", () => {
    it("totals only current eligible payables, rounding 1% for each restaurant", () => {
        const rows = [
            { grossCents: 22100, payzuFeeCents: 133 }, { grossCents: 5390, payzuFeeCents: 32 },
            { grossCents: 3580, payzuFeeCents: 22 }, { grossCents: 3300, payzuFeeCents: 20 },
            { grossCents: 2000, payzuFeeCents: 12 }, { grossCents: 1000, payzuFeeCents: 6 },
            { grossCents: 0, payzuFeeCents: 0, waitingGrossCents: 200 },
            { grossCents: 0, payzuFeeCents: 0, waitingGrossCents: 4289 },
            { grossCents: 0, payzuFeeCents: 0, waitingGrossCents: 2700 },
        ];
        expect(summarizeOnePercentPayouts(rows)).toEqual({ grossCents: 37370, payzuFeeCents: 225, discountCents: 149, netCents: 36996 });
    });
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

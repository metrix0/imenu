export const MIN_PAYOUT_DIFFERENCE_CENTS = -300;
export const MAX_PAYOUT_DIFFERENCE_CENTS = 1_000;

export function calculateOnePercentPayout(
    grossCents: number,
    orderCount: number
) {
    const payzuFeeCents = orderCount * 10;
    const totalDiscountCents = Math.round(grossCents * 0.01);
    const discountCents = totalDiscountCents - payzuFeeCents;
    const netCents = Math.max(
        0,
        grossCents - payzuFeeCents - discountCents
    );

    return { payzuFeeCents, discountCents, netCents };
}

export function isSafePayoutDifference(differenceCents: number): boolean {
    return (
        differenceCents >= MIN_PAYOUT_DIFFERENCE_CENTS &&
        differenceCents <= MAX_PAYOUT_DIFFERENCE_CENTS
    );
}

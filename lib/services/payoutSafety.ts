export const MIN_PAYOUT_DIFFERENCE_CENTS = -300;

export function getMaxPayoutDifferenceCents(totalCents: number): number {
    return Math.max(0, Math.round(totalCents * 0.01));
}

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

export function isSafePayoutDifference(
    differenceCents: number,
    totalCents: number
): boolean {
    return (
        differenceCents >= MIN_PAYOUT_DIFFERENCE_CENTS &&
        differenceCents <= getMaxPayoutDifferenceCents(totalCents)
    );
}

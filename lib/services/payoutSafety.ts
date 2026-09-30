export const MIN_PAYOUT_DIFFERENCE_CENTS = -300;

export function getMaxPayoutDifferenceCents(totalCents: number): number {
    return Math.max(0, Math.round(totalCents * 0.01));
}

export function calculateOnePercentPayout(
    grossCents: number,
    providerFeeCents: number
) {
    // Legacy column/property name retained for historical payout compatibility.
    const payzuFeeCents = providerFeeCents;
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

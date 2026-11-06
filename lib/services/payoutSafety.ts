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

export function summarizeOnePercentPayouts(rows: { grossCents: number; payzuFeeCents: number }[]) {
    const initial = { grossCents: 0, payzuFeeCents: 0, discountCents: 0, netCents: 0 };
    return rows.reduce<typeof initial>((total, row) => {
        const payout = calculateOnePercentPayout(row.grossCents, row.payzuFeeCents);
        return { grossCents: total.grossCents + row.grossCents, payzuFeeCents: total.payzuFeeCents + row.payzuFeeCents,
            discountCents: total.discountCents + payout.discountCents, netCents: total.netCents + payout.netCents };
    }, initial);
}

import { formatPrice } from "@/lib/utils/formatPrice";

export const CASH_CHANGE_OBSERVATION = /Troco[ \t]+para[ \t]*:[ \t]*(?:R\$[ \t]*)?([^\r\n]*)/i;

export function withCashChangeAmount(observation: string, totalCents: number): string {
    return observation.replace(CASH_CHANGE_OBSERVATION, (line, rawAmount: string) => {
        const amount = rawAmount.trim();
        const hasThousands = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(amount);
        const isDecimal = /^\d+(?:[,.]\d{1,2})?$/.test(amount);
        if (!hasThousands && !isDecimal) return line;

        const normalized = hasThousands ? amount.replace(/\./g, "") : amount;
        const tenderedCents = Math.round(Number(normalized.replace(",", ".")) * 100);
        const changeCents = tenderedCents - totalCents;
        return Number.isSafeInteger(changeCents) && changeCents > 0
            ? `${line.trimEnd()}. Levar ${formatPrice(changeCents)}`
            : line;
    });
}

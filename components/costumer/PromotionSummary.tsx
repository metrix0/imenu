"use client";

import { formatPrice } from "@/lib/utils/formatPrice";
import type { AppliedPromotion } from "@/lib/promotions/automatic";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";

export default function PromotionSummary({
  promotion,
}: {
  promotion?: AppliedPromotion | null;
}) {
  const step = useCheckoutStore((state) => state.step);
  if (!promotion || step !== "checkout") return null;

  return (
    <div className="space-y-2 text-[15px] 2xl:text-lg">
      {promotion.benefits.map((benefit, index) => {
        const isFree = /grátis/i.test(benefit.label);
        return (
          <div key={`${benefit.label}-${index}`} className="flex justify-between gap-3">
            <span>{benefit.label}</span>
            <span>
              {isFree ? "GRÁTIS" : `- ${formatPrice(benefit.discount_cents)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

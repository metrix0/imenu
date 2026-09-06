import { formatPrice } from "@/lib/utils/formatPrice";
import type { AppliedPromotion } from "@/lib/promotions/automatic";

export default function PromotionSummary({
  promotion,
}: {
  promotion?: AppliedPromotion | null;
}) {
  if (!promotion) return null;
  return (
    <div className="my-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words font-semibold">
          Promoção: {promotion.name}
        </span>
        <span className="shrink-0 font-semibold">
          −{formatPrice(promotion.discount_cents)}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed">
        {promotion.benefits.map((b) => b.label).join(" · ")}
      </p>
    </div>
  );
}

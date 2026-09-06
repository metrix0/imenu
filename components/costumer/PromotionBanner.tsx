import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag } from "@fortawesome/free-solid-svg-icons";
import {
  promotionDescription,
  type AutomaticPromotion,
  type PromotionProduct,
} from "@/lib/promotions/automatic";

export default function PromotionBanner({
  promotion,
  products,
  applied = false,
}: {
  promotion: AutomaticPromotion;
  products: Pick<PromotionProduct, "id" | "name">[];
  applied?: boolean;
}) {
  const description = promotionDescription(promotion, products);
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 sm:p-5 transition-colors duration-300 ${applied ? "border-green-200 bg-green-50" : "border-brand/20 bg-brand/5"}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors duration-300 ${applied ? "bg-green-600" : "bg-brand"}`}
      >
        <FontAwesomeIcon icon={faTag} />
      </span>
      <div className="min-w-0 break-words">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`text-sm font-extrabold tracking-wider sm:text-base ${applied ? "text-green-700" : "text-brand"}`}
          >
            PROMOÇÃO
          </p>
          {applied && (
            <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
              APLICADA
            </span>
          )}
        </div>
        <p className="mt-1 text-base font-bold leading-snug text-gray-900 sm:text-lg">
          {description.benefits.charAt(0).toUpperCase() +
            description.benefits.slice(1)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Válida {description.conditions}.
        </p>
      </div>
    </div>
  );
}

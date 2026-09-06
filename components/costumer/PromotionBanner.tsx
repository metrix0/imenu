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
}: {
  promotion: AutomaticPromotion;
  products: Pick<PromotionProduct, "id" | "name">[];
}) {
  const description = promotionDescription(promotion, products);
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
        <FontAwesomeIcon icon={faTag} />
      </span>
      <div className="min-w-0 break-words">
        <p className="text-xs font-bold tracking-wider text-brand">PROMOÇÃO</p>
        <p className="mt-1 text-base font-bold leading-snug text-gray-900 sm:text-lg">
          {description.benefits.charAt(0).toUpperCase() +
            description.benefits.slice(1)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Válida {description.conditions}.
        </p>
        {promotion.benefits.some((b) => b.type === "product") && (
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Adicione o produto grátis à sacola. Complementos à parte.{" "}
            {promotion.rules.some((r) => r.type === "minimum") &&
              "O valor mínimo não inclui os produtos grátis."}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          {promotion.allow_coupon
            ? "Pode acumular com cupom."
            : "Não acumula com cupom."}{" "}
          Vale a promoção automática mais vantajosa.
        </p>
      </div>
    </div>
  );
}

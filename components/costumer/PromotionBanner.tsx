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
  categories = [],
  applied = false,
}: {
  promotion: AutomaticPromotion;
  products: Pick<PromotionProduct, "id" | "name">[];
  categories?: { id: string; name: string }[];
  applied?: boolean;
}) {
  const description = promotionDescription(promotion, products, categories);
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 sm:p-5 transition-colors duration-300 ${applied ? "border-[var(--im-menu-success-border,#bbf7d0)] bg-[var(--im-menu-success-bg,#f0fdf4)]" : "border-[var(--im-menu-accent-border,#f1440033)] bg-[var(--im-menu-accent-soft,#f144000d)]"}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors duration-300 ${applied ? "bg-[var(--im-menu-success-fill,#16a34a)]" : "bg-[var(--im-menu-action,#f14400)]"}`}
      >
        <FontAwesomeIcon icon={faTag} />
      </span>
      <div className="min-w-0 break-words">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`text-sm font-extrabold tracking-wider sm:text-base ${applied ? "text-[var(--im-menu-success-text,#15803d)]" : "text-[var(--im-menu-link,#f14400)]"}`}
          >
            PROMOÇÃO
          </p>
          {applied && (
            <span className="rounded-full bg-[var(--im-menu-success-fill,#16a34a)] px-2.5 py-1 text-xs font-bold text-white">
              APLICADA
            </span>
          )}
        </div>
        <p className="mt-1 text-base font-bold leading-snug text-[var(--im-menu-text,#111827)] sm:text-lg">
          {description.benefits.charAt(0).toUpperCase() +
            description.benefits.slice(1)}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--im-menu-muted,#4b5563)]">
          Válida {description.conditions}.
        </p>
      </div>
    </div>
  );
}

"use client";

import MenuProductCard from "@/components/restaurant-owner/mesas/MenuProductCard";
import { IA_PLUS_PRICE_LABEL, IA_PLUS_BENEFITS, IA_PLUS_BONUSES } from "@/lib/addons/products";
import { PROMO_QR_PRICE_LABEL } from "@/lib/addons/promoQr";

export default function IaPlusProductCard({ active, onLearnMore, presentation = "default", promo = false }: { active: boolean; onLearnMore: () => void; presentation?: "default" | "plans"; promo?: boolean }) {
    return (
        <MenuProductCard
            presentation={presentation}
            variant="addon"
            cardClickable={false}
            name="iMenu Plus"
            logo="/logos/PlusCombinationMarkLogo_Brand.png"
            description="Venda mais com iMenu Plus."
            priceLabel={promo ? PROMO_QR_PRICE_LABEL : IA_PLUS_PRICE_LABEL}
            originalPriceLabel={promo ? IA_PLUS_PRICE_LABEL : undefined}
            priceSuffix={promo ? "1º mês via Pix" : undefined}
            features={IA_PLUS_BENEFITS.map((benefit) => benefit.title)}
            featureDetails={presentation === "plans" ? IA_PLUS_BENEFITS : undefined}
            bonuses={IA_PLUS_BONUSES.map((bonus) => bonus.title)}
            bonusDetails={presentation === "plans" ? IA_PLUS_BONUSES : undefined}
            active={active}
            onLearnMore={onLearnMore}
        />
    );
}

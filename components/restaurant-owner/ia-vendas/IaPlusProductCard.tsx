"use client";

import MenuProductCard from "@/components/restaurant-owner/mesas/MenuProductCard";
import { IA_PLUS_PRICE_LABEL, IA_PLUS_BENEFITS, IA_PLUS_BONUSES, IA_PLUS_FREE_INCLUSIONS } from "@/lib/addons/products";

export default function IaPlusProductCard({ active, onLearnMore, presentation = "default" }: { active: boolean; onLearnMore: () => void; presentation?: "default" | "plans" }) {
    return (
        <MenuProductCard
            presentation={presentation}
            variant="addon"
            cardClickable={false}
            name="iMenu Plus"
            logo="/logos/IAPlusCombinationMarkLogo_Brand.png"
            description="Marketing pelo WhatsApp e inteligência artificial para vender mais."
            priceLabel={IA_PLUS_PRICE_LABEL}
            features={IA_PLUS_BENEFITS.map((benefit) => benefit.title)}
            featureDetails={presentation === "plans" ? IA_PLUS_BENEFITS : undefined}
            bonuses={IA_PLUS_BONUSES.map((bonus) => bonus.title)}
            bonusDetails={presentation === "plans" ? IA_PLUS_BONUSES : undefined}
            freeInclusions={presentation === "plans" ? IA_PLUS_FREE_INCLUSIONS : undefined}
            active={active}
            onLearnMore={onLearnMore}
        />
    );
}

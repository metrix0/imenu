"use client";

import MenuProductCard from "@/components/restaurant-owner/mesas/MenuProductCard";
import { IA_PLUS_PRICE_LABEL, IA_PLUS_BENEFITS, IA_PLUS_BONUSES } from "@/lib/addons/products";

export default function IaPlusProductCard({ active, onLearnMore, presentation = "default" }: { active: boolean; onLearnMore: () => void; presentation?: "default" | "plans" }) {
    return (
        <MenuProductCard
            presentation={presentation}
            variant="addon"
            cardClickable={false}
            name="iMenu Plus"
            logo="/logos/PlusCombinationMarkLogo_Brand.svg"
            description="Marketing pelo WhatsApp, inteligência artificial e QR Code em um só plano."
            priceLabel={IA_PLUS_PRICE_LABEL}
            features={IA_PLUS_BENEFITS.map((benefit) => benefit.title)}
            bonuses={IA_PLUS_BONUSES.map((bonus) => bonus.title)}
            active={active}
            onLearnMore={onLearnMore}
        />
    );
}

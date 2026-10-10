"use client";

import MenuProductCard from "@/components/restaurant-owner/mesas/MenuProductCard";
import { IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";

export default function IaPlusProductCard({ active, onLearnMore, presentation = "default" }: { active: boolean; onLearnMore: () => void; presentation?: "default" | "plans" }) {
    return (
        <MenuProductCard
            presentation={presentation}
            variant="addon"
            cardClickable={false}
            name="iMenu IA Plus"
            logo="/logos/IAPlusCombinationMarkLogo_Brand.png"
            description="Assistente IA com capacidade total! Acesso completo às Análise de vendas com IA!"
            priceLabel={IA_PLUS_PRICE_LABEL}
            features={["Assistente IA", "Geração de imagens", "Análise completa"]}
            exclusiveSupport
            active={active}
            onLearnMore={onLearnMore}
        />
    );
}

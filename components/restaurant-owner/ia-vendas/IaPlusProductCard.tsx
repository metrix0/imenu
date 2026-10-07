"use client";

import MenuProductCard from "@/components/restaurant-owner/mesas/MenuProductCard";
import { IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";

export default function IaPlusProductCard({ active, onLearnMore }: { active: boolean; onLearnMore: () => void }) {
    return (
        <MenuProductCard
            variant="addon"
            cardClickable={false}
            name="iMenu IA Plus"
            logo="/logos/IAPlusCombinationMarkLogo_Brand.png"
            description="Assistente IA liberado e com mais capacidade. Acesso completo às oportunidades da Análise de vendas com IA!"
            priceLabel={IA_PLUS_PRICE_LABEL}
            features={["Assistente IA", "Geração de imagens", "Análise completa"]}
            exclusiveSupport
            active={active}
            onLearnMore={onLearnMore}
        />
    );
}

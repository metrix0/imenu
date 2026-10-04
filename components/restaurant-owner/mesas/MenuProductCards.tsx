"use client";

import type { ReactNode } from "react";
import MenuProductCard from "./MenuProductCard";

type MenuProductCardsProps = {
    extraCard?: ReactNode;
    qrSelected: boolean;
    qrActive?: boolean;
    onQrToggle?: () => void;
    onLearnMore: () => void;
};

export default function MenuProductCards({ extraCard, qrSelected, qrActive = false, onQrToggle, onLearnMore }: MenuProductCardsProps) {
    return (
        <div className="panel-product-cards grid gap-5 md:grid-cols-2">
            <MenuProductCard
                variant="included"
                name="iMenu Cardápio Digital"
                logo="/logos/CombinationMarkLogo_Brand.png"
                description="Seu cardápio delivery com produtos, pedidos e gestão pelo painel."
                priceLabel="Grátis para sempre, sem limites"
                features={["Robô WhatsApp", "Pedidos delivery", "Gestão de pedidos"]}
                learnMoreLink={{ href: "/#recursos", label: "Conhecer o Cardápio Digital" }}
            />
            {extraCard}
            <MenuProductCard
                variant="addon"
                name="iMenu QR Code Mesa"
                logo="/logos/QRCODECombinationMarkLogo_Brand.png"
                description="Cardápio digital na mesa através de QR Code"
                priceLabel="R$ 5,00"
                features={["Sem limites", "Painel do Garçom", "Acompanhamento do pedido"]}
                selected={qrSelected}
                active={qrActive}
                onToggle={onQrToggle}
                onLearnMore={onLearnMore}
                exclusiveSupport
            />
        </div>
    );
}

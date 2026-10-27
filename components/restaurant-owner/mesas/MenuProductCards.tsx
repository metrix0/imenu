"use client";

import type { ReactNode } from "react";
import MenuProductCard from "./MenuProductCard";

type MenuProductCardsProps = {
    presentation?: "default" | "plans";
    extraCard?: ReactNode;
    qrSelected: boolean;
    qrActive?: boolean;
    qrIncluded?: boolean;
    onQrToggle?: () => void;
    onLearnMore: () => void;
};

export default function MenuProductCards({ presentation = "default", extraCard }: MenuProductCardsProps) {
    return (
        <div className={presentation === "plans" ? "plans-products" : "panel-product-cards grid gap-5 md:grid-cols-2"}>
            <MenuProductCard
                presentation={presentation}
                variant="included"
                name="iMenu"
                logo="/logos/CombinationMarkLogo_Brand.png"
                description="Seu cardápio delivery com produtos, pedidos e gestão pelo painel."
                priceLabel="Grátis para sempre, sem limites"
                features={["Robô WhatsApp", "Pedidos delivery", "QR Code Mesa"]}
                learnMoreLink={{ href: "/#recursos", label: "Conhecer o Cardápio Digital" }}
            />
            {extraCard}
            {presentation !== "plans" && (
                <MenuProductCard
                presentation={presentation}
                variant="included"
                name="iMenu QR Code Mesa"
                logo="/logos/QRCODECombinationMarkLogo_Brand.png"
                description="Cardápio digital nas mesas com QR Code, sem cobrança."
                priceLabel="Grátis para sempre, sem limites"
                features={["Mesas ilimitadas", "Painel Garçom", "Acompanhamento do pedido"]}
                learnMoreLink={{ href: "/painel/mesas", label: "Gerenciar mesas" }}
                />
            )}
        </div>
    );
}

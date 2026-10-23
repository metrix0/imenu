"use client";

import { useCallback } from "react";
import {
    faBullhorn,
    faPrint,
    faQrcode,
    faRocket,
    faUsers,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import { IA_PLUS_BENEFITS as PLUS_BENEFITS, IA_PLUS_BONUSES } from "@/lib/addons/products";
import PaymentSuccessCelebration from "@/components/payments/PaymentSuccessCelebration";
import { reconcileQrTableCheckout } from "@/lib/qr-table/clientApi";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const QR_TABLE_RETURN_PATHS = [
    "/painel/mesas",
    "/painel/configuracoes",
    "/restaurante/criar/localizacao",
] as const;

const IA_PLUS_RETURN_PATHS = [
    "/painel/assistente-ia",
    "/painel/vendas-ia",
    "/painel/configuracoes",
    "/painel/planos",
    "/painel/marketing",
] as const;

const QR_TABLE_BENEFITS = [
    {
        icon: faQrcode,
        text: "QR Code exclusivo por mesa e QR Code universal",
    },
    {
        icon: faUsers,
        text: "Vários clientes podem pedir ao mesmo tempo pela mesma mesa",
    },
    {
        icon: faPrint,
        text: "Pedidos identificados pela mesa no painel e na impressão",
    },
] as const;

const PLUS_BENEFIT_ICONS = [faBullhorn, faWandMagicSparkles, faRocket, faQrcode] as const;
const IA_PLUS_BENEFITS = PLUS_BENEFITS.map((benefit, index) => ({
    icon: PLUS_BENEFIT_ICONS[index],
    text: benefit.title,
}));

export default function AddonPaymentSuccess() {
    const restaurantId = useCreationStore((state) => state.restaurantId);
    const setProductSelectionCompleted = useCreationStore(
        (state) => state.setProductSelectionCompleted
    );

    const reconcileQrTable = useCallback(
        () => reconcileQrTableCheckout(restaurantId),
        [restaurantId]
    );
    const reconcileIaPlus = useCallback(
        () =>
            reconcileQrTableCheckout(restaurantId, {
                productKey: "ia_plus",
            }),
        [restaurantId]
    );

    const handleQrTableActivated = useCallback(() => {
        if (window.location.pathname === "/restaurante/criar/localizacao") {
            setProductSelectionCompleted(true);
        }
    }, [setProductSelectionCompleted]);

    return (
        <>
            <PaymentSuccessCelebration
                successEventName="imenu:qr-table-activated"
                returnPaths={QR_TABLE_RETURN_PATHS}
                reconcilePayment={reconcileQrTable}
                onActivated={handleQrTableActivated}
                title="Obrigado pela compra!"
                description="Seu iMenu QR Code Mesa foi ativado. Agora você tem novos recursos para atender seus clientes direto pela mesa."
                benefits={QR_TABLE_BENEFITS}
                bonusTitle="BÔNUS: Atendimento Exclusivo"
                bonusDescription="Funcionalidades e melhorias que você pedir e que fizerem sentido serão implementadas em 1 semana."
                actionLabel="Começar a usar"
            />
            <PaymentSuccessCelebration
                successEventName="imenu:ia-plus-activated"
                returnPaths={IA_PLUS_RETURN_PATHS}
                reconcilePayment={reconcileIaPlus}
                title="Obrigado pela compra!"
                description="Seu iMenu Plus foi ativado com Marketing WhatsApp, Assistente IA, Vendas IA e iMenu QR Code incluso."
                benefits={IA_PLUS_BENEFITS}
                bonusTitle="Bônus inclusos"
                bonusDescription={IA_PLUS_BONUSES.map((bonus) => bonus.title).join(", ") + "."}
                actionLabel="Começar a usar"
            />
        </>
    );
}

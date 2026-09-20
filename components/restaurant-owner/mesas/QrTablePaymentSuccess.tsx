"use client";

import { useCallback } from "react";
import {
    faPrint,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";

import PaymentSuccessCelebration from "@/components/payments/PaymentSuccessCelebration";
import { reconcileQrTableCheckout } from "@/lib/qr-table/clientApi";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const RETURN_PATHS = [
    "/painel/mesas",
    "/painel/configuracoes",
    "/restaurante/criar/localizacao",
] as const;

const BENEFITS = [
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

export default function QrTablePaymentSuccess() {
    const restaurantId = useCreationStore((state) => state.restaurantId);
    const setProductSelectionCompleted = useCreationStore(
        (state) => state.setProductSelectionCompleted
    );

    const reconcilePayment = useCallback(
        () => reconcileQrTableCheckout(restaurantId),
        [restaurantId]
    );

    const handleActivated = useCallback(() => {
        if (window.location.pathname === "/restaurante/criar/localizacao") {
            setProductSelectionCompleted(true);
        }
    }, [setProductSelectionCompleted]);

    return (
        <PaymentSuccessCelebration
            successEventName="imenu:qr-table-activated"
            returnPaths={RETURN_PATHS}
            reconcilePayment={reconcilePayment}
            onActivated={handleActivated}
            title="Obrigado pela compra!"
            description="Seu iMenu QR Code Mesa foi ativado. Agora você tem novos recursos para atender seus clientes direto pela mesa."
            benefits={BENEFITS}
            bonusTitle="BÔNUS: Atendimento Exclusivo"
            bonusDescription="Funcionalidades e melhorias que você pedir e que fizerem sentido serão implementadas em 1 semana."
            actionLabel="Começar a usar"
        />
    );
}

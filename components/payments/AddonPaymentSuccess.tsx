"use client";

import { useCallback } from "react";
import {
    faPrint,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";

import PaymentSuccessCelebration from "@/components/payments/PaymentSuccessCelebration";
import IMenuPlusSetup from "@/components/payments/IMenuPlusSetup";
import { reconcileQrTableCheckout } from "@/lib/qr-table/clientApi";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const QR_TABLE_RETURN_PATHS = [
    "/painel/mesas",
    "/painel/configuracoes",
    "/restaurante/criar/localizacao",
] as const;

const IA_PLUS_RETURN_PATHS = [
    "/restaurante/criar/plus",
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
                restaurantId={restaurantId}
                renderSetup={(props) => <IMenuPlusSetup key={props.restaurantId} {...props} />}
            />
        </>
    );
}

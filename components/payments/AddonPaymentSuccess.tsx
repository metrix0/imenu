"use client";

import { useCallback } from "react";
import {
    faArrowTrendUp,
    faImage,
    faPrint,
    faQrcode,
    faUsers,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

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

const IA_PLUS_BENEFITS = [
    {
        icon: faWandMagicSparkles,
        text: "Mais capacidade para conversar com o Assistente IA e realizar tarefas",
    },
    {
        icon: faImage,
        text: "Geração de imagens para produtos, logo e banner",
    },
    {
        icon: faArrowTrendUp,
        text: "Acesso completo à Análise de vendas e às melhorias sugeridas",
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
                title="Obrigado pela compra!"
                description="Seu iMenu IA Plus foi ativado. Agora você tem mais capacidade no Assistente IA e acesso completo à Análise de vendas com IA."
                benefits={IA_PLUS_BENEFITS}
                bonusTitle="Seu acesso já está liberado"
                bonusDescription="Continue no painel para usar o Assistente IA e colocar em prática as oportunidades da sua análise."
                actionLabel="Começar a usar"
            />
        </>
    );
}

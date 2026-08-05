export type ConsumerPipelineStep = {
    key: string;
    label: string;
    value: number | null;
    conversion: number | null;
    available: boolean;
    note: string | null;
    valueType?: "count" | "currency";
};

export type ConsumerTrackingMetrics = {
    available: boolean;
    menuViews: number | null;
    itemViews: number | null;
    addedToCart: number | null;
    averageCartCents: number | null;
    informationStarted: number | null;
    addressStarted: number | null;
    paymentStarted: number | null;
};

function conversion(
    current: number | null,
    previous: number | null
): number | null {
    if (current === null || previous === null || previous <= 0) return null;
    return Number(((current / previous) * 100).toFixed(1));
}

export function buildConsumerPipeline(
    metrics: ConsumerTrackingMetrics,
    ordersPlaced: number
): ConsumerPipelineStep[] {
    const averageCartCents =
        metrics.averageCartCents !== null
            ? Math.round(metrics.averageCartCents)
            : metrics.available
              ? 0
              : null;

    return [
        {
            key: "menu_viewed",
            label: "Ver cardápio",
            value: metrics.menuViews,
            conversion: null,
            available: metrics.available,
            note: metrics.available
                ? "Consumidores únicos que abriram um cardápio"
                : null,
        },
        {
            key: "item_viewed",
            label: "Ver item",
            value: metrics.itemViews,
            conversion: conversion(metrics.itemViews, metrics.menuViews),
            available: metrics.available,
            note: null,
        },
        {
            key: "added_to_cart",
            label: "Adicionar ao carrinho",
            value: metrics.addedToCart,
            conversion: conversion(metrics.addedToCart, metrics.itemViews),
            available: metrics.available,
            note: null,
        },
        {
            key: "average_cart",
            label: "R$ médio por carrinho",
            value: averageCartCents,
            conversion: null,
            available: metrics.available,
            note: metrics.available
                ? "Média ao abrir a sacola"
                : null,
            valueType: "currency",
        },
        {
            key: "information_started",
            label: "Procedeu para informação",
            value: metrics.informationStarted,
            conversion: conversion(
                metrics.informationStarted,
                metrics.addedToCart
            ),
            available: metrics.available,
            note: "Abriu a sacola e iniciou o checkout",
        },
        {
            key: "address_started",
            label: "Procedeu para endereço",
            value: metrics.addressStarted,
            conversion: conversion(
                metrics.addressStarted,
                metrics.informationStarted
            ),
            available: metrics.available,
            note: "Avançou para endereço e informações pessoais",
        },
        {
            key: "payment_started",
            label: "Procedeu para pagamento",
            value: metrics.paymentStarted,
            conversion: conversion(
                metrics.paymentStarted,
                metrics.addressStarted
            ),
            available: metrics.available,
            note: null,
        },
        {
            key: "ordered",
            label: "Pediu",
            value: ordersPlaced,
            conversion: conversion(ordersPlaced, metrics.paymentStarted),
            available: true,
            note: metrics.available
                ? "Pedidos criados no Supabase"
                : "Pedidos do Supabase; conversão aguarda o PostHog",
        },
    ];
}

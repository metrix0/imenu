import {
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";

export type PublicContentPage = {
    path: string;
    label: string;
    kind: "Conteúdo" | "Comparativo" | "Ferramenta" | "Índice";
};

const EXISTING_SEO_PAGES: PublicContentPage[] = [
    {
        path: "/cardapio-digital",
        label: "Top 5 cardápios digitais",
        kind: "Conteúdo",
    },
    {
        path: "/cardapio-digital-gratuito",
        label: "Cardápio digital gratuito",
        kind: "Conteúdo",
    },
    {
        path: "/gestor-de-pedidos",
        label: "Gestor de pedidos",
        kind: "Conteúdo",
    },
    { path: "/anota-ai", label: "iMenu vs Anota Ai", kind: "Comparativo" },
    { path: "/goomer", label: "iMenu vs Goomer", kind: "Comparativo" },
    { path: "/saipos", label: "iMenu vs Saipos", kind: "Comparativo" },
];

export const PUBLIC_CONTENT_PAGES: PublicContentPage[] = [
    ...EXISTING_SEO_PAGES,
    {
        path: "/ferramentas",
        label: "Ferramentas gratuitas",
        kind: "Índice",
    },
    ...RESTAURANT_TOOLS.map((tool) => ({
        path: getRestaurantToolPath(tool.slug),
        label: tool.name,
        kind: "Ferramenta" as const,
    })),
];

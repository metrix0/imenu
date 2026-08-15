import type { Metadata } from "next";

export const BLOG_SITE_URL = "https://www.imenuapp.com.br";

export type BlogArticleDefinition = {
    slug: string;
    title: string;
    shortTitle: string;
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
    category: "Vendas" | "Cardápio" | "Delivery" | "Gestão";
    readingTime: string;
    publishedAt: string;
    updatedAt: string;
};

export const BLOG_ARTICLES: BlogArticleDefinition[] = [
    {
        slug: "quanto-ifood-cobra",
        title: "Quanto o iFood cobra do restaurante? Taxas, planos e cálculo real",
        shortTitle: "Quanto o iFood cobra",
        metaTitle: "Quanto o iFood cobra? Taxas e cálculo em 2026 | iMenu",
        metaDescription:
            "Veja as taxas atuais do iFood, calcule o custo dos planos Básico e Entrega e compare o valor líquido com pedidos diretos.",
        excerpt:
            "Entenda comissão, pagamento online e mensalidade com exemplos de R$ 30 mil — sem confundir taxa nominal com custo efetivo.",
        category: "Gestão",
        readingTime: "10 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
    {
        slug: "alternativa-ao-ifood",
        title: "Alternativa ao iFood: como criar um canal próprio sem perder vendas",
        shortTitle: "Alternativa ao iFood",
        metaTitle: "Alternativa ao iFood: venda no canal próprio | iMenu",
        metaDescription:
            "Compare marketplace e canal próprio e siga um plano de 30 dias para receber pedidos sem depender exclusivamente do iFood.",
        excerpt:
            "Um plano prático para usar o marketplace como aquisição e transformar clientes recorrentes em vendas no seu canal próprio.",
        category: "Delivery",
        readingTime: "12 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
    {
        slug: "como-vender-delivery-pelo-whatsapp",
        title: "Como vender delivery pelo WhatsApp sem perder pedidos",
        shortTitle: "Delivery pelo WhatsApp",
        metaTitle: "Como vender delivery pelo WhatsApp: guia | iMenu",
        metaDescription:
            "Monte um processo de pedidos pelo WhatsApp com cardápio, mensagens prontas, confirmação, organização da cozinha e métricas.",
        excerpt:
            "Do primeiro clique à confirmação: estrutura, mensagens copiáveis e uma rotina que evita pedidos incompletos e conversas perdidas.",
        category: "Vendas",
        readingTime: "13 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
    {
        slug: "como-montar-cardapio-delivery",
        title: "Como montar um cardápio de delivery que facilita a escolha e protege a margem",
        shortTitle: "Como montar cardápio delivery",
        metaTitle: "Como montar um cardápio de delivery que vende | iMenu",
        metaDescription:
            "Aprenda a montar um cardápio delivery: mix, categorias, preços, fotos, descrições, adicionais e checklist antes de publicar.",
        excerpt:
            "Um método completo para decidir o que vender, organizar categorias, escrever descrições e testar o pedido antes de divulgar.",
        category: "Cardápio",
        readingTime: "15 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
    {
        slug: "como-aumentar-ticket-medio-restaurante",
        title: "Como aumentar o ticket médio do restaurante sem destruir a margem",
        shortTitle: "Aumentar o ticket médio",
        metaTitle: "Como aumentar o ticket médio do restaurante | iMenu",
        metaDescription:
            "Calcule seu ticket médio e aplique combos, adicionais e metas de pedido com um plano de testes que também acompanha a margem.",
        excerpt:
            "Estratégias mensuráveis de combo, upsell e complementos — com contas para separar faturamento maior de lucro maior.",
        category: "Vendas",
        readingTime: "12 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
    {
        slug: "como-criar-combo-no-delivery",
        title: "Como criar combos no delivery que parecem vantajosos e continuam lucrativos",
        shortTitle: "Como criar combo no delivery",
        metaTitle: "Como criar combos lucrativos no delivery | iMenu",
        metaDescription:
            "Aprenda a montar e precificar combos de delivery com custo, embalagem, taxa, margem mínima, exemplos e checklist de teste.",
        excerpt:
            "Escolha itens que fazem sentido juntos, calcule o piso de preço e valide o combo com margem de contribuição — não só desconto.",
        category: "Cardápio",
        readingTime: "11 min de leitura",
        publishedAt: "2026-08-15",
        updatedAt: "2026-08-15",
    },
];

export const EXISTING_BLOG_PAGES = [
    {
        path: "/cardapio-digital",
        title: "Os 5 melhores cardápios digitais grátis do Brasil",
        excerpt:
            "Compare as principais plataformas, os modelos de cobrança e os recursos que importam para restaurantes.",
        category: "Cardápio",
    },
    {
        path: "/cardapio-digital-gratuito",
        title: "Cardápio digital gratuito para restaurantes",
        excerpt:
            "Entenda como publicar um menu por link ou QR Code sem mensalidade e sem comissão por pedido.",
        category: "Cardápio",
    },
    {
        path: "/gestor-de-pedidos",
        title: "Gestor de pedidos para restaurante",
        excerpt:
            "Veja como centralizar pedidos, reduzir erros e acompanhar a operação com mais clareza.",
        category: "Gestão",
    },
    {
        path: "/anota-ai",
        title: "iMenu vs Anota Ai",
        excerpt: "Compare foco, simplicidade e modelo de cobrança das duas soluções.",
        category: "Comparativo",
    },
    {
        path: "/goomer",
        title: "iMenu vs Goomer",
        excerpt: "Entenda as diferenças entre cardápio digital e soluções de autoatendimento.",
        category: "Comparativo",
    },
    {
        path: "/saipos",
        title: "iMenu vs Saipos",
        excerpt: "Compare um cardápio digital direto com uma plataforma ampla de gestão e PDV.",
        category: "Comparativo",
    },
] as const;

export function getBlogArticlePath(slug: string): string {
    return `/blog/${slug}`;
}

export function getBlogArticle(slug: string): BlogArticleDefinition | undefined {
    return BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function createBlogArticleMetadata(
    article: BlogArticleDefinition
): Metadata {
    const canonical = `${BLOG_SITE_URL}${getBlogArticlePath(article.slug)}`;

    return {
        title: article.metaTitle,
        description: article.metaDescription,
        alternates: { canonical },
        robots: { index: true, follow: true },
        openGraph: {
            type: "article",
            locale: "pt_BR",
            siteName: "iMenu",
            url: canonical,
            title: article.metaTitle,
            description: article.metaDescription,
            publishedTime: article.publishedAt,
            modifiedTime: article.updatedAt,
        },
        twitter: {
            card: "summary",
            title: article.metaTitle,
            description: article.metaDescription,
        },
    };
}

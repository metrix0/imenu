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
        slug: "taxa-de-entrega-por-bairro",
        title: "Taxa de entrega por bairro: como calcular e configurar no delivery",
        shortTitle: "Taxa de entrega por bairro",
        metaTitle: "Taxa de Entrega por Bairro: Como Calcular | iMenu",
        metaDescription:
            "Aprenda a calcular taxa de entrega por bairro, definir valores por região e automatizar a cobrança no cardápio digital do seu delivery.",
        excerpt:
            "Veja quando cobrar por bairro faz mais sentido do que por quilômetro, como proteger a margem e como configurar taxas e prazos diferentes por região.",
        category: "Delivery",
        readingTime: "11 min de leitura",
        publishedAt: "2026-09-06",
        updatedAt: "2026-09-06",
    },
    {
        slug: "promocoes-para-delivery",
        title: "Promoções para delivery: 8 ideias para vender mais sem perder margem",
        shortTitle: "Promoções para delivery",
        metaTitle: "Promoções para Delivery: 8 Ideias que Vendem | iMenu",
        metaDescription:
            "Veja 8 ideias de promoções para delivery com frete grátis, descontos, valor mínimo e brindes para aumentar vendas sem destruir a margem.",
        excerpt:
            "Use promoções com objetivo claro: aumentar ticket, movimentar dias fracos, reduzir a barreira do frete e criar ofertas automáticas sem depender de cupom.",
        category: "Vendas",
        readingTime: "12 min de leitura",
        publishedAt: "2026-09-06",
        updatedAt: "2026-09-06",
    },
    {
        slug: "aplicativo-para-garcom",
        title: "Aplicativo para garçom: como fazer pedidos pelo celular e organizar as mesas",
        shortTitle: "Aplicativo para garçom",
        metaTitle: "Aplicativo para Garçom: Pedidos pelo Celular | iMenu",
        metaDescription:
            "Veja como funciona um aplicativo para garçom, a diferença para comanda eletrônica e como lançar e acompanhar pedidos das mesas pelo celular.",
        excerpt:
            "Entenda como transformar o celular da equipe em um painel de mesas e pedidos, sem depender de papel e sem confundir app do garçom com autoatendimento.",
        category: "Gestão",
        readingTime: "10 min de leitura",
        publishedAt: "2026-08-31",
        updatedAt: "2026-08-31",
    },
    {
        slug: "melhor-qr-code-mesa-restaurante",
        title: "Melhor QR Code para restaurante em 2026: 4 sistemas para pedidos na mesa",
        shortTitle: "Melhor QR Code para restaurante",
        metaTitle: "Melhor QR Code para Restaurante em 2026: 4 Opções | iMenu",
        metaDescription:
            "Compare iMenu, Goomer, Anota AI e Saipos para pedidos por QR Code na mesa. Veja recursos, preço, diferenças e qual opção faz mais sentido.",
        excerpt:
            "Comparamos quatro sistemas de QR Code para mesa que permitem ao cliente acessar o cardápio e pedir pelo próprio celular.",
        category: "Cardápio",
        readingTime: "10 min de leitura",
        publishedAt: "2026-08-24",
        updatedAt: "2026-08-24",
    },
    {
        slug: "cardapio-digital-qr-code-restaurante",
        title: "Cardápio digital com QR Code para restaurante: como receber pedidos direto da mesa",
        shortTitle: "Cardápio digital com QR Code",
        metaTitle: "Cardápio Digital QR Code para Restaurante | iMenu",
        metaDescription:
            "Veja como usar cardápio digital com QR Code no restaurante para receber pedidos direto da mesa, identificar mesas e agilizar o atendimento.",
        excerpt:
            "Entenda como funciona o QR Code na mesa, a diferença entre apenas mostrar o menu e receber pedidos e como colocar o sistema para funcionar.",
        category: "Cardápio",
        readingTime: "11 min de leitura",
        publishedAt: "2026-08-23",
        updatedAt: "2026-08-23",
    },
    {
        slug: "robo-whatsapp-para-restaurante",
        title: "Robô de WhatsApp para restaurante: automatize atendimento sem perder o toque humano",
        shortTitle: "Robô de WhatsApp para restaurante",
        metaTitle: "Robô de WhatsApp para restaurante: guia | iMenu",
        metaDescription:
            "Veja como usar robô, chatbot e atendimento automático no WhatsApp do restaurante para enviar cardápio, status, entrega e pagamentos.",
        excerpt:
            "Um fluxo prático de chatbot para responder dúvidas repetitivas, levar o cliente ao cardápio e transferir exceções para a equipe.",
        category: "Vendas",
        readingTime: "10 min de leitura",
        publishedAt: "2026-08-17",
        updatedAt: "2026-08-17",
    },
    {
        slug: "criar-cardapio-com-ia",
        title: "Como criar cardápio com IA a partir de foto ou PDF",
        shortTitle: "Criar cardápio com IA",
        metaTitle: "Como criar cardápio com IA por foto ou PDF | iMenu",
        metaDescription:
            "Aprenda a digitalizar um cardápio com IA usando fotos ou PDFs, revisar categorias, produtos, descrições e preços e publicar mais rápido.",
        excerpt:
            "Transforme o material que você já tem em uma estrutura de cardápio digital e revise o resultado antes de colocar os produtos no ar.",
        category: "Cardápio",
        readingTime: "10 min de leitura",
        publishedAt: "2026-08-17",
        updatedAt: "2026-08-17",
    },
    {
        slug: "programa-fidelidade-restaurante",
        title: "Programa de fidelidade para restaurante: como criar selos e recompensas",
        shortTitle: "Programa de fidelidade para restaurante",
        metaTitle: "Programa de fidelidade para restaurante: guia | iMenu",
        metaDescription:
            "Crie um programa de fidelidade para restaurante com meta de pedidos, valor mínimo, recompensa e regras simples para incentivar recompra.",
        excerpt:
            "Defina quantos pedidos liberam o prêmio, escolha uma recompensa sustentável e acompanhe um ciclo simples de recompra e resgate.",
        category: "Vendas",
        readingTime: "9 min de leitura",
        publishedAt: "2026-08-17",
        updatedAt: "2026-08-17",
    },
    {
        slug: "controle-estoque-cardapio-digital",
        title: "Controle de estoque no cardápio digital: evite vender item esgotado",
        shortTitle: "Controle de estoque no cardápio digital",
        metaTitle: "Controle de estoque no cardápio digital | iMenu",
        metaDescription:
            "Veja como controlar quantidade por produto no cardápio digital, bloquear venda sem estoque e organizar a atualização do saldo durante o turno.",
        excerpt:
            "Controle unidades dos produtos que realmente podem acabar e deixe a disponibilidade do cardápio acompanhar o saldo da operação.",
        category: "Cardápio",
        readingTime: "9 min de leitura",
        publishedAt: "2026-08-17",
        updatedAt: "2026-08-17",
    },
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

import type { Metadata } from "next";

export type ComparisonPageDefinition = {
    slug: string;
    competitor: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    competitorOverview: string;
    mainDifference: string;
    competitorFit: string;
    imenuFit: string;
    excerpt: string;
    checklist: readonly string[];
};

export const COMPARISON_PAGES = [
    {
        slug: "consumer",
        competitor: "Consumer",
        metaTitle: "iMenu vs Consumer | Comparação para Restaurantes",
        metaDescription:
            "Compare iMenu e Consumer em cardápio digital, delivery, PDV e gestão para entender qual solução faz mais sentido para seu restaurante.",
        intro:
            "Compare iMenu e Consumer para entender a diferença entre uma solução focada em cardápio digital e pedidos e uma plataforma mais ampla de gestão para restaurantes.",
        competitorOverview:
            "O Consumer reúne recursos de PDV, mesas, comandas, cardápio digital, delivery, integrações com marketplaces, estoque, financeiro e emissão fiscal. É uma opção voltada para restaurantes que querem centralizar várias rotinas da operação em um único sistema.",
        mainDifference:
            "A principal diferença está no escopo. O Consumer funciona como um sistema de gestão mais completo, enquanto o iMenu prioriza uma experiência simples para publicar o cardápio, receber pedidos e operar o canal próprio sem exigir a adoção de um ERP completo.",
        competitorFit:
            "O Consumer pode fazer mais sentido para operações que precisam de PDV, fiscal, estoque, mesas e outros módulos de gestão conectados ao mesmo sistema.",
        imenuFit:
            "O iMenu tende a ser mais direto para quem quer colocar o cardápio digital e o canal próprio de pedidos no ar rapidamente, com menos configuração e sem mensalidade para começar.",
        excerpt:
            "Compare o foco enxuto do iMenu com a estrutura de PDV, delivery e gestão do Consumer.",
        checklist: [
            "Defina se você precisa apenas vender online ou também substituir seu PDV e gestão interna.",
            "Compare o tempo de implantação e o treinamento exigido da equipe.",
            "Calcule o custo total dos módulos que realmente serão usados.",
            "Teste o fluxo completo do pedido no celular do cliente e no painel da operação.",
        ],
    },
    {
        slug: "grandchef",
        competitor: "GrandChef",
        metaTitle: "iMenu vs GrandChef | Comparação para Restaurantes",
        metaDescription:
            "Compare iMenu e GrandChef em cardápio digital, delivery, PDV, mesas e gestão para escolher a melhor opção para seu restaurante.",
        intro:
            "Veja como iMenu e GrandChef se diferenciam em simplicidade, cardápio digital e profundidade de gestão para restaurantes e delivery.",
        competitorOverview:
            "O GrandChef oferece uma operação integrada com PDV, mesas e comandas, cardápio digital, estoque, financeiro, integrações com marketplaces e automação de atendimento pelo WhatsApp.",
        mainDifference:
            "O GrandChef concentra vários módulos da operação em uma plataforma ampla. O iMenu tem um foco mais específico em cardápio digital, pedidos e experiência do cliente, reduzindo a quantidade de configuração necessária para começar.",
        competitorFit:
            "O GrandChef pode ser adequado para restaurantes que querem centralizar salão, caixa, estoque, financeiro, delivery e atendimento em uma solução única.",
        imenuFit:
            "O iMenu é mais indicado quando a prioridade é ter um cardápio digital moderno e um canal próprio de pedidos de forma simples, rápida e sem contratar uma estrutura maior de gestão.",
        excerpt:
            "Entenda a diferença entre o cardápio digital enxuto do iMenu e a plataforma completa do GrandChef.",
        checklist: [
            "Liste quais módulos operacionais são realmente necessários hoje.",
            "Verifique se a equipe precisa de PDV, estoque e financeiro no mesmo sistema.",
            "Compare implantação, suporte e eventuais custos recorrentes.",
            "Faça um pedido real em cada solução antes de decidir.",
        ],
    },
    {
        slug: "delivery-direto",
        competitor: "Delivery Direto",
        metaTitle: "iMenu vs Delivery Direto | Comparação de Delivery Próprio",
        metaDescription:
            "Compare iMenu e Delivery Direto para criar um canal próprio de pedidos, reduzir dependência de marketplaces e vender diretamente ao cliente.",
        intro:
            "Compare iMenu e Delivery Direto para entender qual abordagem combina melhor com restaurantes que querem fortalecer o próprio canal de vendas.",
        competitorOverview:
            "O Delivery Direto é voltado para canal próprio de delivery e oferece recursos para receber pedidos, trabalhar a base de clientes, criar promoções e fidelidade e organizar a operação sem depender exclusivamente de marketplaces.",
        mainDifference:
            "As duas soluções ajudam o restaurante a vender diretamente, mas partem de propostas diferentes. O Delivery Direto enfatiza uma plataforma própria de delivery e relacionamento, enquanto o iMenu prioriza um cardápio digital simples, rápido de publicar e integrado ao fluxo de pedidos.",
        competitorFit:
            "O Delivery Direto pode fazer sentido para operações que valorizam um ecossistema de delivery próprio com campanhas, fidelização e recursos de relacionamento mais amplos.",
        imenuFit:
            "O iMenu é uma alternativa direta para restaurantes que querem começar pelo cardápio e pelos pedidos, sem transformar a implantação em um projeto grande ou adicionar mensalidade para começar.",
        excerpt:
            "Compare duas formas de construir um canal próprio de delivery sem depender apenas de marketplaces.",
        checklist: [
            "Compare a experiência de compra no celular e a velocidade para concluir um pedido.",
            "Verifique quais ferramentas de fidelidade e marketing você realmente pretende usar.",
            "Calcule mensalidades, taxas e serviços adicionais do canal próprio.",
            "Confirme como os dados e a base de clientes ficam disponíveis para o restaurante.",
        ],
    },
    {
        slug: "wabiz",
        competitor: "WAbiz",
        metaTitle: "iMenu vs WAbiz | Cardápio Digital e App de Delivery",
        metaDescription:
            "Compare iMenu e WAbiz em cardápio digital, pedidos online, aplicativo próprio, promoções e relacionamento com clientes.",
        intro:
            "Veja as diferenças entre iMenu e WAbiz para restaurantes que avaliam cardápio digital, pedidos online e um canal próprio de delivery.",
        competitorOverview:
            "A WAbiz trabalha com aplicativos próprios e personalizados para delivery, além de pedidos online, retirada no local, notificações push, promoções e recursos para redes de lojas.",
        mainDifference:
            "A WAbiz coloca bastante peso no aplicativo próprio da marca. O iMenu funciona principalmente pela web, permitindo que o cliente abra o cardápio por link ou QR Code e faça o pedido sem precisar instalar um aplicativo específico do restaurante.",
        competitorFit:
            "A WAbiz pode ser interessante para marcas que consideram um aplicativo próprio parte importante da estratégia de relacionamento e recorrência.",
        imenuFit:
            "O iMenu tende a ser mais simples para operações que preferem reduzir a fricção do cliente e concentrar a experiência em um cardápio acessível diretamente pelo navegador.",
        excerpt:
            "Compare o modelo de aplicativo próprio da WAbiz com o cardápio web direto do iMenu.",
        checklist: [
            "Decida se seus clientes realmente precisam instalar um aplicativo da marca.",
            "Compare o fluxo de primeiro pedido para um cliente novo.",
            "Verifique custos de implantação, personalização e manutenção do canal.",
            "Teste notificações, retirada e acompanhamento do pedido nas duas opções.",
        ],
    },
    {
        slug: "neemo",
        competitor: "Neemo",
        metaTitle: "iMenu vs Neemo | Comparação de Cardápio e Delivery",
        metaDescription:
            "Compare iMenu e Neemo para pedidos online, site ou aplicativo próprio, cardápio digital, pagamentos e fidelização no delivery.",
        intro:
            "Compare iMenu e Neemo e veja qual solução se encaixa melhor na estratégia de pedidos diretos do seu restaurante.",
        competitorOverview:
            "A Neemo oferece estrutura de pedidos online com site e aplicativo personalizados, cardápio, pagamentos, entrega ou retirada e recursos de fidelização para restaurantes e redes.",
        mainDifference:
            "A Neemo segue uma proposta de plataforma de delivery própria com site e app personalizados. O iMenu aposta em uma experiência mais enxuta de cardápio e pedidos pelo navegador, com menos etapas para o restaurante começar.",
        competitorFit:
            "A Neemo pode fazer sentido para operações que procuram uma estrutura de delivery personalizada com aplicativo e site próprios como parte central da marca.",
        imenuFit:
            "O iMenu é mais direto para quem quer vender pelo próprio cardápio sem exigir instalação de app pelo cliente e sem começar por uma implantação mais pesada.",
        excerpt:
            "Compare a estrutura de site e app da Neemo com a experiência web mais enxuta do iMenu.",
        checklist: [
            "Compare a experiência de compra entre site, app e cardápio web.",
            "Verifique como funcionam pagamentos, retirada e área de entrega.",
            "Avalie se um aplicativo próprio é prioridade para sua marca.",
            "Confirme as condições comerciais e integrações necessárias para sua operação.",
        ],
    },
    {
        slug: "olaclick",
        competitor: "OlaClick",
        metaTitle: "iMenu vs OlaClick | Comparação de Cardápio Digital",
        metaDescription:
            "Compare iMenu e OlaClick em cardápio digital, pedidos, PDV, WhatsApp, estoque, cozinha e recursos de marketing para restaurantes.",
        intro:
            "Compare iMenu e OlaClick para entender as diferenças entre uma solução focada em cardápio e pedidos e uma plataforma com mais módulos operacionais.",
        competitorOverview:
            "A OlaClick reúne cardápio digital, PDV, pedidos por WhatsApp e delivery, gestão de mesas, inventário, KDS e ferramentas de marketing e automação com IA.",
        mainDifference:
            "A OlaClick combina cardápio digital com diversos módulos de operação e marketing. O iMenu mantém o foco principal em cardápio, pedidos e experiência de compra, o que pode tornar a implantação mais simples para operações que não precisam de todos esses módulos.",
        competitorFit:
            "A OlaClick pode fazer sentido para restaurantes que querem centralizar PDV, cozinha, estoque, atendimento e marketing em uma plataforma mais abrangente.",
        imenuFit:
            "O iMenu é uma opção mais direta para quem quer um cardápio digital completo e pedidos próprios sem precisar adotar uma suíte maior para começar.",
        excerpt:
            "Compare o foco direto do iMenu com o conjunto mais amplo de PDV, KDS e marketing da OlaClick.",
        checklist: [
            "Liste os módulos que sua equipe realmente usará no dia a dia.",
            "Compare o esforço de configuração inicial das duas plataformas.",
            "Teste cardápio, carrinho, pagamento e recebimento do pedido.",
            "Revise preços e condições comerciais atuais antes de contratar.",
        ],
    },
    {
        slug: "cardapio-web",
        competitor: "Cardápio Web",
        metaTitle: "iMenu vs Cardápio Web | Comparação para Restaurantes",
        metaDescription:
            "Compare iMenu e Cardápio Web em vendas diretas, cardápio digital, gestão, delivery, marketing e integrações para restaurantes.",
        intro:
            "Veja como iMenu e Cardápio Web se posicionam para restaurantes que querem vender diretamente e ter mais controle sobre o canal próprio.",
        competitorOverview:
            "A Cardápio Web se apresenta como uma estrutura de e-commerce para restaurantes, combinando canal próprio de vendas com recursos de gestão, marketing, integrações e ferramentas operacionais.",
        mainDifference:
            "A Cardápio Web busca concentrar vendas, gestão e marketing em uma plataforma ampla. O iMenu prioriza o cardápio digital e o fluxo de pedidos, mantendo uma proposta mais simples para começar e operar.",
        competitorFit:
            "A Cardápio Web pode fazer mais sentido para restaurantes que querem uma infraestrutura mais ampla de e-commerce, gestão e marketing conectada ao canal próprio.",
        imenuFit:
            "O iMenu tende a ser mais adequado para quem quer publicar o cardápio, receber pedidos e evoluir o canal próprio com uma configuração mais enxuta.",
        excerpt:
            "Compare o e-commerce completo da Cardápio Web com a proposta simples e direta do iMenu.",
        checklist: [
            "Defina se você busca apenas pedidos próprios ou uma plataforma ampla de e-commerce e gestão.",
            "Compare as integrações necessárias para seu restaurante.",
            "Avalie a facilidade para cadastrar, atualizar e pausar produtos.",
            "Calcule o custo total do conjunto de recursos que pretende usar.",
        ],
    },
    {
        slug: "simpliza",
        competitor: "Simpliza",
        metaTitle: "iMenu vs Simpliza | Cardápio Digital e Sistema para Restaurante",
        metaDescription:
            "Compare iMenu e Simpliza em cardápio digital, delivery, PDV, comandas, fiscal e integrações para escolher a melhor solução para seu restaurante.",
        intro:
            "Compare iMenu e Simpliza para entender quando vale escolher uma solução focada em cardápio e pedidos ou um sistema mais completo para gestão do restaurante.",
        competitorOverview:
            "O Simpliza oferece PDV, cardápio digital, comandas, controle de pedidos, emissão fiscal, gestão administrativa e integrações com canais de delivery como iFood e aiqfome.",
        mainDifference:
            "O Simpliza foi desenhado para cobrir várias etapas da gestão e do atendimento do restaurante. O iMenu concentra a experiência no cardápio digital e no recebimento de pedidos, reduzindo a quantidade de módulos envolvidos para começar.",
        competitorFit:
            "O Simpliza pode fazer sentido para operações que precisam integrar caixa, comandas, fiscal e delivery dentro do mesmo sistema.",
        imenuFit:
            "O iMenu é mais direto para restaurantes que querem fortalecer o cardápio e o canal próprio sem precisar trocar ou ampliar todo o sistema de gestão.",
        excerpt:
            "Compare a estrutura de PDV e gestão do Simpliza com o foco em cardápio e pedidos do iMenu.",
        checklist: [
            "Mapeie se o restaurante precisa substituir PDV, fiscal e comandas ou apenas melhorar o canal digital.",
            "Compare a curva de aprendizado para a equipe.",
            "Teste o pedido no salão e no delivery conforme sua operação real.",
            "Confirme integrações, suporte e condições comerciais antes da decisão.",
        ],
    },
] as const satisfies readonly ComparisonPageDefinition[];

export function getComparisonPage(slug: string): ComparisonPageDefinition {
    const page = COMPARISON_PAGES.find((item) => item.slug === slug);
    if (!page) throw new Error(`Unknown comparison page: ${slug}`);
    return page;
}

export function createComparisonMetadata(
    page: ComparisonPageDefinition
): Metadata {
    const canonical = `https://imenuapp.com.br/${page.slug}`;

    return {
        title: page.metaTitle,
        description: page.metaDescription,
        alternates: { canonical },
        robots: { index: true, follow: true },
        openGraph: {
            type: "article",
            locale: "pt_BR",
            siteName: "iMenu",
            url: canonical,
            title: page.metaTitle,
            description: page.metaDescription,
        },
    };
}

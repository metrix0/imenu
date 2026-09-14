import { faChartLine } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
} from "@/components/common/blog/BlogArticle";
import type { ComparisonPageDefinition } from "@/lib/seo/comparisonPages";

type ComparisonRow = {
    label: string;
    imenu: string;
    competitor: string;
};

type ComparisonVisuals = {
    sourceUrl: string;
    highlights: Array<{ title: string; description: string }>;
    rows: ComparisonRow[];
    competitorBestFor: string[];
};

const VISUALS: Record<string, ComparisonVisuals> = {
    consumer: {
        sourceUrl: "https://consumer.com.br/",
        highlights: [
            { title: "PDV e salão", description: "Mesas, comandas, caixa e operação presencial fazem parte da proposta central." },
            { title: "Gestão completa", description: "Estoque, ficha técnica, financeiro e recursos fiscais ficam conectados ao restante da operação." },
            { title: "Ecossistema integrado", description: "Cardápio, delivery próprio e integrações entram na mesma plataforma de gestão." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e pedidos próprios", competitor: "Gestão completa do restaurante" },
            { label: "PDV e salão", imenu: "Não é o foco principal", competitor: "PDV, mesas e comandas" },
            { label: "Gestão interna", imenu: "Estrutura mais enxuta", competitor: "Estoque, financeiro, ficha técnica e fiscal" },
            { label: "Canal digital", imenu: "Link/QR Code com pedidos próprios", competitor: "Delivery próprio, cardápio e integrações" },
            { label: "Melhor encaixe", imenu: "Quem quer vender direto sem trocar toda a operação", competitor: "Quem quer centralizar gestão e vendas" },
        ],
        competitorBestFor: [
            "Você quer substituir ou centralizar o PDV",
            "Estoque, fiscal e financeiro precisam estar no mesmo sistema",
            "Salão, comandas e delivery devem compartilhar a mesma base operacional",
        ],
    },
    grandchef: {
        sourceUrl: "https://www.grandchef.com.br/",
        highlights: [
            { title: "Operação de salão", description: "PDV, mesas, comandas, QR Code e aplicativo para garçom ficam integrados." },
            { title: "Estoque e financeiro", description: "A plataforma cobre controle operacional além do cardápio e dos pedidos online." },
            { title: "Delivery e WhatsApp", description: "Delivery próprio, marketplaces e automação de atendimento fazem parte da proposta mais ampla." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e canal próprio", competitor: "Gestão ampla de salão e delivery" },
            { label: "PDV e salão", imenu: "Não exige adotar um ERP completo", competitor: "PDV, mesas, comandas e garçom" },
            { label: "Backoffice", imenu: "Mais simples", competitor: "Estoque, caixa, financeiro e relatórios" },
            { label: "Delivery", imenu: "Pedidos próprios pelo cardápio", competitor: "Delivery próprio + marketplaces + automações" },
            { label: "Melhor encaixe", imenu: "Operação que quer começar pelo canal digital", competitor: "Operação que quer digitalizar várias áreas de uma vez" },
        ],
        competitorBestFor: [
            "Você quer PDV, salão e delivery dentro da mesma plataforma",
            "Controle de estoque e financeiro é parte central da decisão",
            "Sua equipe quer centralizar marketplaces e atendimento junto da operação",
        ],
    },
    "delivery-direto": {
        sourceUrl: "https://www.deliverydireto.com.br/",
        highlights: [
            { title: "Canal próprio", description: "A proposta gira em torno de reduzir dependência de marketplaces e vender direto ao cliente." },
            { title: "Relacionamento", description: "Campanhas, fidelização e uso da base de clientes têm peso importante na estratégia." },
            { title: "Operação de delivery", description: "O produto é pensado como uma estrutura própria de pedidos e recorrência para delivery." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital + pedidos próprios", competitor: "Ecossistema de delivery próprio" },
            { label: "Entrada no canal próprio", imenu: "Fluxo enxuto pelo navegador", competitor: "Plataforma dedicada ao delivery direto" },
            { label: "Relacionamento", imenu: "Promoções, fidelidade e WhatsApp dentro do ecossistema iMenu", competitor: "Campanhas e relacionamento como parte importante da proposta" },
            { label: "Complexidade inicial", imenu: "Prioriza colocar cardápio e pedidos no ar", competitor: "Estrutura mais voltada à estratégia completa de delivery" },
            { label: "Melhor encaixe", imenu: "Quem quer começar simples", competitor: "Quem quer investir mais no canal próprio como operação de marketing e venda" },
        ],
        competitorBestFor: [
            "Canal próprio é um projeto estratégico de marketing e recorrência",
            "Você quer trabalhar campanhas e base de clientes de forma mais ampla",
            "A operação está disposta a estruturar o delivery direto como um ecossistema próprio",
        ],
    },
    wabiz: {
        sourceUrl: "https://wabiz.com.br/",
        highlights: [
            { title: "Aplicativo próprio", description: "A marca pode ter um app personalizado como canal recorrente de pedidos." },
            { title: "Comunicação direta", description: "Notificações e ações de relacionamento ajudam a trazer o cliente de volta ao canal próprio." },
            { title: "Marca no centro", description: "A experiência busca reforçar identidade visual e recorrência dentro do aplicativo da operação." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio web e pedidos", competitor: "Aplicativo próprio de delivery" },
            { label: "Primeiro acesso", imenu: "Link ou QR Code no navegador", competitor: "Experiência orientada ao app da marca" },
            { label: "Recorrência", imenu: "Canal web + fidelidade e promoções", competitor: "App, notificações e relacionamento direto" },
            { label: "Fricção para o cliente", imenu: "Não exige instalar app", competitor: "O app próprio é parte importante da proposta" },
            { label: "Melhor encaixe", imenu: "Quem prioriza acesso imediato", competitor: "Marca que quer um aplicativo próprio como ativo estratégico" },
        ],
        competitorBestFor: [
            "Ter um aplicativo próprio faz parte da estratégia da marca",
            "Push e comunicação dentro do app são importantes para recorrência",
            "Sua base de clientes já tem volume para justificar incentivar instalações",
        ],
    },
    neemo: {
        sourceUrl: "https://neemo.com.br/",
        highlights: [
            { title: "Site e app próprios", description: "A solução trabalha a presença digital do restaurante com canais personalizados de pedido." },
            { title: "Delivery estruturado", description: "Entrega, retirada, pagamentos e jornada do pedido fazem parte da plataforma." },
            { title: "Fidelização", description: "A proposta inclui recursos para estimular recorrência no canal da própria marca." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e pedidos pelo navegador", competitor: "Site/app próprios para delivery" },
            { label: "Canal", imenu: "Web por link e QR Code", competitor: "Estrutura personalizada de site e aplicativo" },
            { label: "Implantação", imenu: "Mais enxuta", competitor: "Mais orientada à presença digital própria completa" },
            { label: "Recorrência", imenu: "Fidelidade e promoções dentro do cardápio", competitor: "Experiência de marca e fidelização no ecossistema próprio" },
            { label: "Melhor encaixe", imenu: "Quem quer começar rápido pelo cardápio", competitor: "Quem quer site e app próprios como parte central da estratégia" },
        ],
        competitorBestFor: [
            "Você quer combinar site e aplicativo personalizados",
            "A marca precisa de uma estrutura própria de delivery mais completa",
            "Fidelização dentro do ecossistema próprio é prioridade",
        ],
    },
    olaclick: {
        sourceUrl: "https://olaclick.com/",
        highlights: [
            { title: "PDV e mesas", description: "A OlaClick combina cardápio digital com operação presencial e ponto de venda." },
            { title: "Cozinha e estoque", description: "KDS e inventário ampliam a plataforma para dentro da operação." },
            { title: "IA e marketing", description: "Chatbot, campanhas e recursos de IA fazem parte da proposta de automação." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e pedidos", competitor: "Suite de restaurante com PDV, delivery e marketing" },
            { label: "Operação interna", imenu: "Mais enxuta", competitor: "PDV, mesas, estoque e KDS" },
            { label: "WhatsApp", imenu: "Robô e notificações conectados ao canal próprio", competitor: "Pedidos, chatbot e automações" },
            { label: "Marketing", imenu: "Promoções e fidelidade", competitor: "Marketing e automações com IA" },
            { label: "Melhor encaixe", imenu: "Quem quer priorizar o cardápio", competitor: "Quem quer centralizar mais módulos em uma única plataforma" },
        ],
        competitorBestFor: [
            "Você quer PDV, cozinha e estoque conectados ao canal digital",
            "Automação de marketing com IA pesa bastante na decisão",
            "A ideia é reduzir a quantidade de sistemas separados na operação",
        ],
    },
    "cardapio-web": {
        sourceUrl: "https://cardapioweb.com/",
        highlights: [
            { title: "E-commerce para restaurantes", description: "A proposta vai além do menu e posiciona o canal próprio como uma operação de venda digital." },
            { title: "Gestão e integrações", description: "Recursos operacionais e conexões com outros serviços ampliam o escopo da plataforma." },
            { title: "Marketing", description: "Ferramentas para aquisição e recorrência acompanham a frente de pedidos online." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e pedidos próprios", competitor: "E-commerce e operação digital do restaurante" },
            { label: "Escopo", imenu: "Mais enxuto", competitor: "Vendas, gestão, integrações e marketing" },
            { label: "Implantação", imenu: "Prioriza simplicidade e velocidade", competitor: "Estrutura mais ampla de canal próprio" },
            { label: "Operação", imenu: "Pode conviver com ferramentas já usadas", competitor: "Busca concentrar mais partes da operação digital" },
            { label: "Melhor encaixe", imenu: "Quem quer cardápio e pedidos sem projeto grande", competitor: "Quem quer estruturar o canal próprio como e-commerce mais completo" },
        ],
        competitorBestFor: [
            "Você quer uma operação de e-commerce mais ampla para o restaurante",
            "Gestão, integrações e marketing devem caminhar junto dos pedidos",
            "O canal próprio é um projeto maior do que simplesmente publicar um cardápio",
        ],
    },
    simpliza: {
        sourceUrl: "https://simpliza.com.br/",
        highlights: [
            { title: "PDV e comandas", description: "Frente de caixa, mesas, comandas e operação presencial fazem parte do sistema." },
            { title: "Fiscal e gestão", description: "Emissão fiscal, estoque, caixa e rotinas administrativas ampliam o escopo." },
            { title: "Delivery integrado", description: "Cardápio próprio e integrações de delivery chegam ao mesmo PDV da operação." },
        ],
        rows: [
            { label: "Foco principal", imenu: "Cardápio digital e pedidos", competitor: "Sistema de vendas e gestão para restaurante" },
            { label: "PDV e salão", imenu: "Não é o foco principal", competitor: "PDV, mesas e comandas" },
            { label: "Backoffice", imenu: "Mais enxuto", competitor: "Fiscal, estoque, caixa e administrativo" },
            { label: "Delivery", imenu: "Canal próprio pelo cardápio", competitor: "Cardápio próprio + integrações de delivery" },
            { label: "Melhor encaixe", imenu: "Quem não quer trocar todo o sistema de gestão", competitor: "Quem quer caixa, salão e delivery dentro da mesma solução" },
        ],
        competitorBestFor: [
            "Você quer centralizar PDV, comandas e delivery",
            "Fiscal, caixa e estoque fazem parte da mesma decisão",
            "A operação prefere substituir várias ferramentas por um sistema mais completo",
        ],
    },
};

const IMENU_BEST_FOR = [
    "Cardápio digital e pedidos próprios são a prioridade agora",
    "Você quer começar sem mensalidade no produto principal",
    "Não quer substituir toda a estrutura de gestão só para melhorar o canal digital",
];

export default function ComparisonBlogArticle({
    comparison,
}: {
    comparison: ComparisonPageDefinition;
}) {
    const visual = VISUALS[comparison.slug];
    if (!visual) throw new Error(`Missing comparison visuals: ${comparison.slug}`);

    const article = {
        slug: comparison.slug,
        title: `iMenu vs ${comparison.competitor}: qual faz mais sentido para seu restaurante?`,
        shortTitle: `iMenu vs ${comparison.competitor}`,
        metaTitle: comparison.metaTitle,
        metaDescription: comparison.metaDescription,
        excerpt: comparison.excerpt,
        category: "Comparativo" as const,
        readingTime: "8 min de leitura",
        publishedAt: "2026-09-14",
        updatedAt: "2026-09-14",
    };

    const sections = [
        { id: "resumo", label: "Resumo em 30 segundos" },
        { id: "lado-a-lado", label: "Comparativo lado a lado" },
        { id: "pontos-fortes", label: `Onde ${comparison.competitor} se destaca` },
        { id: "imenu", label: "Onde o iMenu se destaca" },
        { id: "qual-escolher", label: "Qual escolher" },
        { id: "checklist", label: "Checklist de decisão" },
        { id: "perguntas-frequentes", label: "Perguntas frequentes" },
    ];

    const faq = [
        {
            question: `iMenu ou ${comparison.competitor}: qual escolher?`,
            answer: `${comparison.competitorFit} ${comparison.imenuFit}`,
        },
        {
            question: `${comparison.competitor} tem cardápio digital?`,
            answer: comparison.competitorOverview,
        },
        {
            question: "Preciso trocar meu sistema de gestão para usar o iMenu?",
            answer:
                "Não necessariamente. O iMenu pode funcionar como seu cardápio digital e canal próprio de pedidos sem exigir que você troque toda a estrutura de gestão do restaurante.",
        },
        {
            question: "O cliente precisa instalar aplicativo para pedir no iMenu?",
            answer:
                "Não. O cliente pode abrir o cardápio pelo navegador usando um link ou QR Code e concluir o pedido sem instalar um aplicativo específico do restaurante.",
        },
        {
            question: "O iMenu cobra mensalidade?",
            answer:
                "O cardápio digital principal do iMenu pode ser usado sem mensalidade. Recursos adicionais específicos podem ter cobrança própria.",
        },
    ];

    return (
        <BlogArticle
            article={article}
            canonicalUrl={`https://imenuapp.com.br/${comparison.slug}`}
            icon={faChartLine}
            takeaways={[
                "Uma visão rápida das diferenças sem precisar ler uma parede de texto",
                `Os pontos em que ${comparison.competitor} realmente muda a operação`,
                "Um checklist direto para decidir pelo seu cenário, não pelo número de recursos",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "alternativa-ao-ifood",
                "como-vender-delivery-pelo-whatsapp",
                "cardapio-digital-qr-code-restaurante",
            ]}
            ctaTitle="Crie seu cardápio digital e teste o canal próprio do iMenu"
        >
            <BlogSection id="resumo" title="Resumo em 30 segundos">
                <figure className="overflow-hidden rounded-3xl border border-orange-200 bg-orange-50 shadow-sm">
                    <img
                        src="/images/Top-5-Cardapios-Digitais.png"
                        alt={`Comparação de cardápios digitais: iMenu e ${comparison.competitor}`}
                        className="block h-auto w-full"
                    />
                    <figcaption className="border-t border-orange-200 bg-white px-5 py-3 text-xs leading-5 text-gray-500">
                        A mesma imagem usada no guia dos melhores cardápios digitais do iMenu.
                    </figcaption>
                </figure>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-brand/30 bg-orange-50/70 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-bold text-gray-950">iMenu</h3>
                            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
                                Mais direto
                            </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                            Cardápio digital e canal próprio de pedidos como prioridade, sem exigir que o restaurante adote um ERP completo para começar.
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-gray-700">
                            <li>• Link e QR Code direto no navegador</li>
                            <li>• Produto principal sem mensalidade para começar</li>
                            <li>• Menos módulos para configurar antes de vender</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-950">{comparison.competitor}</h3>
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                            {comparison.competitorFit}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-gray-700">
                            {visual.highlights.map((item) => (
                                <li key={item.title}>• {item.title}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <BlogCallout title="A diferença principal" variant="tip">
                    {comparison.mainDifference}
                </BlogCallout>
            </BlogSection>

            <BlogSection id="lado-a-lado" title={`iMenu vs ${comparison.competitor}: lado a lado`}>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Critério</th>
                                <th className="bg-orange-50/70 px-5 py-4 font-bold text-brand">iMenu</th>
                                <th className="px-5 py-4 font-bold">{comparison.competitor}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            {visual.rows.map((row) => (
                                <tr key={row.label}>
                                    <td className="px-5 py-4 font-semibold text-gray-950">{row.label}</td>
                                    <td className="bg-orange-50/30 px-5 py-4">{row.imenu}</td>
                                    <td className="px-5 py-4">{row.competitor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-sm leading-6 text-gray-500">
                    O objetivo aqui não é premiar quem tem mais funções. É mostrar como o escopo de cada produto muda o trabalho necessário para implantar e operar a solução.
                </p>
            </BlogSection>

            <BlogSection id="pontos-fortes" title={`Onde o ${comparison.competitor} se destaca`}>
                <div className="grid gap-4 md:grid-cols-3">
                    {visual.highlights.map((item, index) => (
                        <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                                {index + 1}
                            </span>
                            <h3 className="mt-4 font-bold text-gray-950">{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                        </div>
                    ))}
                </div>
                <p>{comparison.competitorOverview}</p>
            </BlogSection>

            <BlogSection id="imenu" title="Onde o iMenu se destaca">
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ["Comece enxuto", "Você pode publicar o cardápio e começar a receber pedidos sem transformar a implantação em uma troca completa de ERP."],
                        ["Menos fricção", "O cliente acessa pelo navegador via link ou QR Code, sem depender da instalação de um aplicativo próprio."],
                        ["Canal próprio primeiro", "Cardápio, pedidos, promoções, fidelidade e WhatsApp ficam concentrados na experiência direta com o cliente."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-brand/20 bg-orange-50/60 p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
                <BlogCallout title="Quando essa simplicidade vale mais" variant="info">
                    {comparison.imenuFit}
                </BlogCallout>
            </BlogSection>

            <BlogSection id="qual-escolher" title={`Então: iMenu ou ${comparison.competitor}?`}>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Escolha {comparison.competitor} se...
                        </span>
                        <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                            {visual.competitorBestFor.map((item) => (
                                <li key={item} className="rounded-xl bg-gray-50 px-4 py-3">{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-brand/30 bg-orange-50/70 p-6 shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wide text-brand">
                            Escolha iMenu se...
                        </span>
                        <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                            {IMENU_BEST_FOR.map((item) => (
                                <li key={item} className="rounded-xl bg-white/80 px-4 py-3">{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <BlogCallout title="Atalho para decidir" variant="tip">
                    Se a sua decisão começa por PDV, fiscal, estoque, salão ou uma estrutura operacional completa, compare esses módulos com bastante peso. Se a prioridade é colocar um canal próprio de pedidos no ar com menos configuração, o iMenu tende a ser a escolha mais direta.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="checklist" title="Checklist antes de trocar ou contratar">
                <BlogChecklist items={[...comparison.checklist]} />

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
                    <strong className="text-gray-950">Última revisão:</strong> setembro de 2026. Recursos, preços e condições comerciais podem mudar. Para conferir a oferta atual do concorrente, consulte o{" "}
                    <a
                        href={visual.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand underline underline-offset-2"
                    >
                        site oficial do {comparison.competitor}
                    </a>
                    .
                </div>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faMoneyBillTransfer } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("alternativa-ao-ifood")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "melhor-alternativa", label: "A melhor alternativa" },
    { id: "canais", label: "O papel de cada canal" },
    { id: "estrutura-minima", label: "Estrutura mínima" },
    { id: "plano-30-dias", label: "Plano de 30 dias" },
    { id: "economia", label: "Comparar a economia" },
    { id: "metricas", label: "Métricas e decisão" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Qual é a melhor alternativa ao iFood para restaurante pequeno?",
        answer:
            "Para muitos restaurantes pequenos, a alternativa mais controlável é combinar cardápio online próprio, link de pedidos, WhatsApp Business e uma rotina clara de pagamento e entrega. A melhor escolha depende de quem traz demanda, quem entrega e quanto custa atender cada pedido.",
    },
    {
        question: "É possível receber pedidos sem iFood?",
        answer:
            "Sim. O restaurante pode divulgar um cardápio próprio por link ou QR Code e receber pedidos diretamente. Ainda será necessário organizar pagamento, produção, atendimento e entrega ou retirada.",
    },
    {
        question: "Devo cancelar o iFood quando criar meu canal próprio?",
        answer:
            "Não automaticamente. O marketplace pode continuar útil para descoberta e clientes novos. Comece medindo os dois canais e só reduza investimento onde o volume não compensa a margem ou a função estratégica.",
    },
    {
        question: "Canal próprio significa delivery sem custo?",
        answer:
            "Não. Mesmo sem comissão de marketplace, podem existir taxas de pagamento, entrega, divulgação, desconto, embalagem e tempo operacional. O ganho deve ser calculado pela margem líquida de cada pedido.",
    },
];

export default function AlternativaAoIfoodPage() {
    return (
        <BlogArticle
            article={article}
            icon={faMoneyBillTransfer}
            takeaways={[
                "Uma estratégia de canais que não depende de decisões radicais",
                "A estrutura mínima para receber pedidos diretamente",
                "Um plano de 30 dias com métricas para decidir com segurança",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "quanto-ifood-cobra",
                "como-vender-delivery-pelo-whatsapp",
                "como-montar-cardapio-delivery",
            ]}
            ctaTitle="Comece seu canal próprio gratuitamente"
        >
            <BlogSection id="melhor-alternativa" title="A melhor alternativa ao iFood não precisa excluir o iFood">
                <p>
                    Para a maioria dos restaurantes, a decisão mais segura não é trocar um
                    aplicativo por outro da noite para o dia. É construir um {" "}
                    <strong>canal próprio capaz de atender clientes recorrentes</strong>,
                    enquanto o marketplace continua sendo avaliado pelo que entrega em
                    descoberta, conveniência e logística.
                </p>
                <BlogCallout title="Pense em função, não em torcida" variant="tip">
                    Marketplace pode funcionar como vitrine e aquisição. Canal próprio pode
                    funcionar como relacionamento e recorrência. Um canal só merece espaço
                    quando sua margem e sua função justificam o esforço.
                </BlogCallout>
                <p>
                    A alternativa prática costuma ser um conjunto simples: cardápio online
                    atualizado, link fácil de compartilhar, processo de pedido, pagamento,
                    entrega ou retirada e uma base de clientes que autorizou o contato.
                </p>
            </BlogSection>

            <BlogSection id="canais" title="O que o marketplace faz — e o que o canal próprio precisa assumir">
                <p>
                    Comparar somente a comissão gera uma decisão incompleta. O marketplace
                    reúne várias tarefas. Se você levar pedidos para um canal próprio,
                    precisa decidir como cada uma será resolvida.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Necessidade</th>
                                <th className="px-5 py-4 font-bold">Marketplace</th>
                                <th className="px-5 py-4 font-bold">Canal próprio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Descoberta</td>
                                <td className="px-5 py-4">Audiência e busca dentro do app</td>
                                <td className="px-5 py-4">Google, Instagram, QR Code, indicação e base própria</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Cardápio</td>
                                <td className="px-5 py-4">Página dentro da plataforma</td>
                                <td className="px-5 py-4">Link do restaurante, sob seu controle</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Pedido</td>
                                <td className="px-5 py-4">Fluxo padronizado pelo app</td>
                                <td className="px-5 py-4">Sistema próprio ou processo organizado no WhatsApp</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Pagamento</td>
                                <td className="px-5 py-4">Processado pela plataforma</td>
                                <td className="px-5 py-4">Pix, maquininha, link ou outro meio escolhido pela loja</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Entrega</td>
                                <td className="px-5 py-4">Própria ou oferecida pelo plano</td>
                                <td className="px-5 py-4">Equipe própria, parceiro logístico ou retirada</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Relacionamento</td>
                                <td className="px-5 py-4">Mediado pela plataforma</td>
                                <td className="px-5 py-4">Direto, com consentimento e rotina de pós-venda</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogSubheading>Quando o canal próprio tende a fazer mais sentido</BlogSubheading>
                <BlogChecklist
                    items={[
                        "Clientes já procuram o restaurante pelo nome",
                        "Existe volume relevante de recompra",
                        "A loja consegue organizar entrega ou retirada",
                        "A equipe consegue confirmar e acompanhar pedidos",
                        "Há itens com margem apertada no marketplace",
                        "O cardápio muda e precisa ser atualizado rapidamente",
                    ]}
                />
                <BlogSubheading>Quando o marketplace ainda pode ser essencial</BlogSubheading>
                <p>
                    Negócios novos, com pouca lembrança de marca e sem operação de entrega
                    podem depender da demanda e da logística do aplicativo. Nesse caso, o
                    canal próprio começa pequeno, principalmente com clientes que já
                    conhecem a loja.
                </p>
            </BlogSection>

            <BlogSection id="estrutura-minima" title="Estrutura mínima para receber pedidos sem iFood">
                <p>
                    Não comece por automações complexas. Primeiro garanta que um cliente
                    consiga encontrar, escolher, pagar e acompanhar o pedido sem precisar
                    perguntar o básico no chat.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Cardápio online sempre atualizado",
                            description: "Produtos, preços, adicionais, disponibilidade e fotos precisam estar em um único link. PDF desatualizado cria dúvida e retrabalho.",
                        },
                        {
                            title: "Entrada de pedido padronizada",
                            description: "O pedido deve chegar com itens, variações, identificação, endereço ou retirada, pagamento e observações.",
                        },
                        {
                            title: "Confirmação com prazo",
                            description: "Confirme valor total, forma de pagamento, endereço, taxa de entrega e previsão antes de iniciar a produção.",
                        },
                        {
                            title: "Fila visível para a equipe",
                            description: "Todo pedido precisa de status e responsável. Conversa aberta no celular não pode ser o único controle da cozinha.",
                        },
                        {
                            title: "Entrega ou retirada definida",
                            description: "Delimite bairros, taxas, horários, prazo e o que acontece quando não há entregador disponível.",
                        },
                        {
                            title: "Divulgação rastreável",
                            description: "Use links ou cupons diferentes por canal para saber se Google, Instagram, QR Code e WhatsApp realmente geram pedidos.",
                        },
                    ]}
                />
                <BlogToolLink
                    href="/ferramentas/gerador-qr-code-cardapio"
                    title="Crie o QR Code do seu cardápio"
                    description="Gere gratuitamente um QR Code com as cores da marca e teste antes de imprimir."
                />
            </BlogSection>

            <BlogSection id="plano-30-dias" title="Plano de 30 dias para construir o canal próprio">
                <p>
                    O objetivo do primeiro mês não é migrar todos os pedidos. É provar que
                    o fluxo funciona, medir a margem e corrigir gargalos sem arriscar o
                    faturamento atual.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            week: "Semana 1",
                            title: "Preparar",
                            items: ["Publicar o cardápio", "Definir pagamento e entrega", "Treinar confirmação e status", "Fazer cinco pedidos de teste"],
                        },
                        {
                            week: "Semana 2",
                            title: "Abrir para clientes próximos",
                            items: ["Divulgar no balcão e embalagens", "Adicionar link no Instagram e Google", "Atender sem promoção agressiva", "Registrar cada falha"],
                        },
                        {
                            week: "Semana 3",
                            title: "Melhorar conversão",
                            items: ["Corrigir itens com dúvidas", "Reduzir etapas manuais", "Destacar mais vendidos", "Testar complemento ou combo"],
                        },
                        {
                            week: "Semana 4",
                            title: "Comparar e decidir",
                            items: ["Calcular margem por canal", "Medir recompra e cancelamento", "Ouvir equipe e clientes", "Definir próximo volume de teste"],
                        },
                    ].map((phase) => (
                        <div key={phase.week} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <p className="text-sm font-semibold text-brand">{phase.week}</p>
                            <h3 className="mt-1 text-lg font-bold text-gray-950">{phase.title}</h3>
                            <ul className="mt-4 space-y-2 text-sm text-gray-600">
                                {phase.items.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
                <BlogCallout title="Não ofereça desconto antes de conhecer a margem" variant="warning">
                    O canal próprio já pode ter um custo menor. Transformar toda a economia
                    em cupom pode aumentar volume e ainda piorar o lucro. Primeiro calcule;
                    depois decida quanto da vantagem vira incentivo ao cliente.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="economia" title="Como saber se a alternativa realmente economiza">
                <p>
                    Use o mesmo período, o mesmo tipo de pedido e os custos que realmente
                    variam entre canais. Comparar receita bruta de um canal com lucro do
                    outro não serve para decisão.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Margem por pedido</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        venda − produto − embalagem − pagamento − comissão − entrega − desconto − aquisição
                    </p>
                </div>
                <p>
                    Além da margem, acompanhe o custo operacional. Se um pedido direto exige
                    dez mensagens, duas correções e conferência manual, parte da economia
                    está sendo consumida por retrabalho.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm text-gray-500">Marketplace</p>
                        <p className="mt-2 font-bold text-gray-950">Margem + clientes novos</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">Avalie se a aquisição compensa o custo do canal.</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm text-gray-500">Canal próprio</p>
                        <p className="mt-2 font-bold text-gray-950">Margem + recompra</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">Avalie facilidade, relacionamento e recorrência.</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
                        <p className="text-sm text-gray-500">Mix saudável</p>
                        <p className="mt-2 font-bold text-gray-950">Função clara por canal</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">Invista onde cada real produz margem ou aquisição útil.</p>
                    </div>
                </div>
                <BlogToolLink
                    href="/ferramentas/calculadora-taxas-ifood"
                    title="Compare o custo do marketplace em reais"
                    description="Use as taxas do seu contrato e veja custo mensal, custo por pedido e valor líquido estimado."
                />
            </BlogSection>

            <BlogSection id="metricas" title="Métricas que decidem se o canal deve crescer">
                <BlogChecklist
                    items={[
                        "Pedidos e faturamento por canal",
                        "Margem de contribuição por pedido",
                        "Ticket médio por canal",
                        "Taxa de cancelamento e erro",
                        "Tempo entre pedido e confirmação",
                        "Percentual de clientes que repetem",
                        "Custo de divulgação por primeiro pedido",
                        "Pedidos que exigem correção manual",
                    ]}
                />
                <p>
                    Revise semanalmente no início. Se o canal direto aumenta margem, mantém
                    qualidade e gera recompra, amplie a divulgação gradualmente. Se ele
                    sobrecarrega atendimento ou entrega, corrija a operação antes de trazer
                    mais volume.
                </p>
                <p>
                    Para organizar o atendimento direto, continue com o guia de {" "}
                    <Link
                        href="/blog/como-vender-delivery-pelo-whatsapp"
                        className="font-semibold text-brand underline"
                    >
                        como vender delivery pelo WhatsApp
                    </Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

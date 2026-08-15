import Link from "next/link";
import { faReceipt } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogReadingNote,
    BlogSection,
    BlogSubheading,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("quanto-ifood-cobra")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "resposta-rapida", label: "Resposta rápida" },
    { id: "planos-e-taxas", label: "Planos e taxas" },
    { id: "como-calcular", label: "Como calcular" },
    { id: "exemplo-30-mil", label: "Exemplo com R$ 30 mil" },
    { id: "comparar-canal-proprio", label: "Comparar canal próprio" },
    { id: "decisao", label: "Tomar a decisão" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Quanto o iFood cobra por pedido do restaurante?",
        answer:
            "Nas condições padrão consultadas em 14 de agosto de 2026, a comissão publicada é de 12% no Plano Básico e 23% no Plano Entrega. Pedidos pagos no iFood também têm taxa publicada de 3,2%. Condições comerciais podem variar, então o contrato da loja é a fonte final.",
    },
    {
        question: "O iFood cobra mensalidade?",
        answer:
            "Nas condições padrão publicadas, há mensalidade quando o faturamento no iFood ultrapassa R$ 1.800 no mês: R$ 110 no Plano Básico e R$ 150 no Plano Entrega. Confirme o valor e eventuais promoções no Portal do Parceiro.",
    },
    {
        question: "Somar 12% e 3,2% sempre dá o custo real?",
        answer:
            "Não. A comissão incide sobre os pedidos, mas a taxa de pagamento online depende da parcela paga dentro do aplicativo. A mensalidade e outras condições também alteram a taxa efetiva.",
    },
    {
        question: "Vale a pena sair do iFood?",
        answer:
            "Não existe resposta única. O marketplace pode gerar descoberta, pagamento e logística; o canal próprio pode ser melhor para recorrência e relacionamento. Compare margem por canal e faça a transição sem desligar um canal que ainda traz pedidos rentáveis.",
    },
];

export default function QuantoIfoodCobraPage() {
    return (
        <BlogArticle
            article={article}
            icon={faReceipt}
            takeaways={[
                "A composição das taxas padrão dos planos Básico e Entrega",
                "Uma conta completa para transformar percentuais em reais",
                "Um método justo para comparar marketplace e canal próprio",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "alternativa-ao-ifood",
                "como-vender-delivery-pelo-whatsapp",
                "como-aumentar-ticket-medio-restaurante",
            ]}
            ctaTitle="Tenha também um canal direto de pedidos"
        >
            <BlogSection id="resposta-rapida" title="Quanto o iFood cobra: resposta rápida">
                <p>
                    Nas condições padrão publicadas pelo iFood e consultadas em
                    14 de agosto de 2026, o <strong>Plano Básico</strong> cobra 12% de
                    comissão e o <strong>Plano Entrega</strong> cobra 23%. Quando o
                    pedido é pago dentro do aplicativo, há ainda uma taxa publicada de
                    3,2%. Acima de R$ 1.800 de faturamento mensal na plataforma, as
                    mensalidades informadas são de R$ 110 e R$ 150, respectivamente.
                </p>
                <BlogCallout title="Seu contrato vem antes de qualquer tabela" variant="warning">
                    Promoções, região, categoria, serviços adicionais e negociação podem
                    mudar os valores. Use os números abaixo como referência e confirme as
                    condições da sua loja no Portal do Parceiro.
                </BlogCallout>
                <BlogReadingNote>
                    Fonte dos valores: página oficial de {" "}
                    <a
                        href="https://parceiros.ifood.com.br/restaurante/planos-ifood"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand underline"
                    >
                        Planos iFood para Restaurantes
                    </a>. A data da consulta fica explícita porque preços e regras podem mudar.
                </BlogReadingNote>
            </BlogSection>

            <BlogSection id="planos-e-taxas" title="Planos do iFood e taxas publicadas">
                <p>
                    A diferença principal é quem realiza a entrega. No Básico, o
                    restaurante cuida da logística. No Entrega, a entrega é feita por
                    parceiros da plataforma — por isso a comissão é maior.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Custo padrão</th>
                                <th className="px-5 py-4 font-bold">Plano Básico</th>
                                <th className="px-5 py-4 font-bold">Plano Entrega</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Comissão sobre pedidos</td>
                                <td className="px-5 py-4">12%</td>
                                <td className="px-5 py-4">23%</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Pagamento pelo iFood</td>
                                <td className="px-5 py-4">3,2% sobre a parcela paga no app</td>
                                <td className="px-5 py-4">3,2% sobre a parcela paga no app</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Mensalidade publicada</td>
                                <td className="px-5 py-4">R$ 110</td>
                                <td className="px-5 py-4">R$ 150</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Quando há mensalidade</td>
                                <td className="px-5 py-4">Faturamento acima de R$ 1.800/mês</td>
                                <td className="px-5 py-4">Faturamento acima de R$ 1.800/mês</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Entrega</td>
                                <td className="px-5 py-4">Responsabilidade da loja</td>
                                <td className="px-5 py-4">Parceiros de entrega do iFood</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm">
                    A mensalidade não deve ser dividida cegamente pelo faturamento. Em
                    uma loja com poucos pedidos ela pesa mais por pedido; com muito volume,
                    seu peso percentual diminui.
                </p>
            </BlogSection>

            <BlogSection id="como-calcular" title="Como calcular o custo real do iFood">
                <p>
                    Separe os componentes. A comissão usa o faturamento total dos pedidos;
                    a taxa de pagamento usa somente o faturamento pago dentro do app; e a
                    mensalidade entra uma vez no mês, quando aplicável.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Fórmula</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        custo total = (vendas × comissão) + (vendas pagas no app × 3,2%) + mensalidade
                    </p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        taxa efetiva = custo total ÷ vendas × 100
                    </p>
                </div>
                <BlogSubheading>Por que a taxa efetiva é mais útil?</BlogSubheading>
                <p>
                    Porque ela responde quanto a plataforma consumiu do faturamento no
                    mês, já considerando a forma de pagamento e a mensalidade. Também
                    permite comparar períodos com volumes diferentes.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-taxas-ifood"
                    title="Calcule as taxas do seu contrato"
                    description="Informe faturamento, ticket, pagamentos online e valores negociados para ver custo total, líquido e custo por pedido."
                />
            </BlogSection>

            <BlogSection id="exemplo-30-mil" title="Exemplo: R$ 30 mil por mês no iFood">
                <p>
                    Considere R$ 30.000 em pedidos, todos pagos dentro do aplicativo e
                    faturamento acima do limite de mensalidade. O cálculo é uma estimativa
                    dos custos da plataforma, antes de impostos, ingredientes, embalagem,
                    equipe e entrega própria.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6">
                        <p className="text-sm font-semibold text-brand">Plano Básico</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-950">R$ 4.670</p>
                        <ul className="mt-4 space-y-2 text-sm text-gray-600">
                            <li>Comissão: R$ 3.600</li>
                            <li>Pagamento online: R$ 960</li>
                            <li>Mensalidade: R$ 110</li>
                            <li className="pt-2 font-semibold text-gray-900">Taxa efetiva: 15,57%</li>
                            <li className="font-semibold text-gray-900">Líquido antes dos outros custos: R$ 25.330</li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-6">
                        <p className="text-sm font-semibold text-brand">Plano Entrega</p>
                        <p className="mt-2 text-3xl font-extrabold text-gray-950">R$ 8.010</p>
                        <ul className="mt-4 space-y-2 text-sm text-gray-600">
                            <li>Comissão: R$ 6.900</li>
                            <li>Pagamento online: R$ 960</li>
                            <li>Mensalidade: R$ 150</li>
                            <li className="pt-2 font-semibold text-gray-900">Taxa efetiva: 26,70%</li>
                            <li className="font-semibold text-gray-900">Líquido antes dos outros custos: R$ 21.990</li>
                        </ul>
                    </div>
                </div>
                <BlogCallout title="Pagamento fora do app muda a conta" variant="info">
                    Se somente 60% dos R$ 30 mil forem pagos no aplicativo, a taxa de
                    pagamento do Básico cai de R$ 960 para R$ 576. O custo estimado passa
                    a R$ 4.286, ou 14,29% do faturamento.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="comparar-canal-proprio" title="Como comparar iFood e canal próprio sem distorcer a conta">
                <p>
                    Pedido direto não significa pedido sem custo. Compare a margem de
                    contribuição de cada canal, incluindo tudo que muda quando o pedido
                    entra por ele.
                </p>
                <BlogChecklist
                    items={[
                        "Comissão e mensalidade do marketplace",
                        "Taxa do meio de pagamento",
                        "Entrega ou subsídio de frete",
                        "Desconto bancado pelo restaurante",
                        "Embalagem e custo variável do produto",
                        "Custo de aquisição ou divulgação do canal",
                        "Tempo operacional para receber e confirmar",
                        "Cancelamentos, reembolsos e inadimplência",
                    ]}
                />
                <BlogSubheading>Compare por pedido e por origem</BlogSubheading>
                <p>
                    Um cliente novo vindo do marketplace pode justificar um custo maior de
                    aquisição. Já um cliente recorrente que procura diretamente sua marca
                    tende a ser um bom candidato para o canal próprio. A comparação útil não
                    é “qual canal custa menos em qualquer situação?”, mas “qual é a função e
                    a margem de cada canal?”.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="font-bold text-gray-950">Conta mínima por canal</p>
                    <p className="mt-3 font-mono text-sm leading-7 text-gray-700">
                        margem por pedido = venda − produto − embalagem − pagamento − comissão − entrega − desconto
                    </p>
                </div>
            </BlogSection>

            <BlogSection id="decisao" title="Decisão prática: o que fazer com esses números">
                <p>
                    Não aumente preços nem desligue canais com base apenas na comissão.
                    Primeiro, calcule a margem por item e por canal. Depois, escolha uma
                    ação pequena que possa ser medida por duas a quatro semanas.
                </p>
                <BlogChecklist
                    items={[
                        "Copiar as taxas exatas do contrato ou Portal do Parceiro",
                        "Calcular custo efetivo e custo por pedido dos últimos três meses",
                        "Separar novos clientes de clientes recorrentes",
                        "Identificar itens que ficam sem margem depois das taxas",
                        "Testar um canal direto com link e cardápio sempre atualizado",
                        "Reavaliar margem, volume e recompra antes de ampliar o teste",
                    ]}
                />
                <p>
                    Se a dependência do marketplace é alta, veja o guia de {" "}
                    <Link href="/blog/alternativa-ao-ifood" className="font-semibold text-brand underline">
                        alternativa ao iFood
                    </Link>. Ele mostra como construir um canal próprio sem sacrificar a
                    demanda que a plataforma já traz.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

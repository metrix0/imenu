import Link from "next/link";
import { faPercent } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogReadingNote,
    BlogSection,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("taxa-ifood-para-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "taxas", label: "Taxas do iFood" },
    { id: "o-que-entra", label: "O que entra na conta" },
    { id: "exemplo", label: "Exemplo por pedido" },
    { id: "como-conferir", label: "Como conferir" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Qual é a taxa do iFood para restaurante?",
        answer:
            "Nas páginas oficiais consultadas em 7 de outubro de 2026, a comissão publicada é de 12% no Plano Básico e 23% no Plano Entrega. A taxa para pagamentos via iFood aparece como 3,2% na página de planos e 3,5% na página de entregas, por isso o contrato ou Portal do Parceiro da sua loja é a referência final.",
    },
    {
        question: "O iFood cobra mensalidade do restaurante?",
        answer:
            "As condições padrão publicadas mostram mensalidade acima de R$ 1.800 de faturamento mensal na plataforma: R$ 110 no Plano Básico e R$ 150 no Plano Entrega. Promoções e condições comerciais podem alterar esses valores.",
    },
    {
        question: "A comissão do iFood é a única taxa?",
        answer:
            "Não. Além da comissão, pode existir taxa para pagamento via iFood e mensalidade. Outros custos do restaurante, como embalagem, imposto e entrega própria, também afetam a margem, mas não são taxas da plataforma.",
    },
];

export default function TaxaIfoodParaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faPercent}
            takeaways={[
                "Quais cobranças entram na conta do restaurante",
                "A diferença entre comissão, pagamento online e mensalidade",
                "Como conferir a taxa efetiva sem depender de estimativas",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "quanto-ifood-cobra",
                "comissao-ifood",
                "quanto-sobra-restaurante-ifood",
            ]}
            ctaTitle="Compare o marketplace com seu canal próprio"
        >
            <BlogSection id="taxas" title="Taxa do iFood para restaurante: resposta rápida">
                <p>
                    O custo do iFood não é uma única porcentagem. Nas condições padrão
                    publicadas para restaurantes, existem três componentes principais:
                    <strong> comissão sobre os pedidos</strong>, taxa quando o pagamento é
                    feito via iFood e mensalidade quando o faturamento supera o limite
                    informado pela plataforma.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Cobrança publicada</th>
                                <th className="px-5 py-4 font-bold">Plano Básico</th>
                                <th className="px-5 py-4 font-bold">Plano Entrega</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Comissão</td>
                                <td className="px-5 py-4">12%</td>
                                <td className="px-5 py-4">23%</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Pagamento via iFood</td>
                                <td className="px-5 py-4">3,2% na página de planos</td>
                                <td className="px-5 py-4">3,2% na página de planos</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Mensalidade</td>
                                <td className="px-5 py-4">R$ 110 acima de R$ 1.800/mês</td>
                                <td className="px-5 py-4">R$ 150 acima de R$ 1.800/mês</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogReadingNote>
                    Consulta feita em 7 de outubro de 2026. A página oficial de {" "}
                    <a href="https://parceiros.ifood.com.br/restaurante/planos-ifood" target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                        planos
                    </a>{" "}
                    mostra 3,2% para pagamento via iFood, enquanto a página oficial de {" "}
                    <a href="https://parceiros.ifood.com.br/restaurante/como-funciona/entregas" target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                        entregas
                    </a>{" "}
                    mostra 3,5%. Confirme o valor do seu contrato antes de tomar decisões.
                </BlogReadingNote>
            </BlogSection>

            <BlogSection id="o-que-entra" title="O que realmente entra na conta">
                <p>
                    A comissão normalmente acompanha o valor vendido. A taxa de pagamento
                    só deve ser aplicada à parcela paga dentro da plataforma. A mensalidade
                    entra uma vez no mês quando a condição de faturamento é atingida.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Fórmula prática</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        custo iFood = comissão + taxa de pagamento + mensalidade
                    </p>
                </div>
                <BlogCallout title="Não confunda taxa do iFood com custo do pedido" variant="tip">
                    Ingredientes, embalagem, impostos, descontos bancados pelo restaurante e
                    entrega própria diminuem a margem, mas devem ser analisados separadamente
                    para você saber quanto pertence à plataforma e quanto pertence à operação.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo de taxa em um pedido de R$ 50">
                <p>
                    Usando apenas como referência os 3,2% exibidos na página oficial de
                    planos, um pedido de R$ 50 pago via iFood teria R$ 6 de comissão no
                    Plano Básico e R$ 1,60 de taxa de pagamento. Antes da mensalidade e dos
                    demais custos do restaurante, sobrariam R$ 42,40.
                </p>
                <p>
                    No Plano Entrega, a comissão publicada de 23% representa R$ 11,50 no
                    mesmo pedido. Somando R$ 1,60 de pagamento, sobrariam R$ 36,90 antes
                    da mensalidade e dos outros custos.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-taxas-ifood"
                    title="Calcule com as taxas do seu contrato"
                    description="Troque os percentuais, informe o faturamento e veja o custo total, o líquido e o custo por pedido."
                />
            </BlogSection>

            <BlogSection id="como-conferir" title="Como conferir a taxa do seu restaurante">
                <p>
                    Use a tabela pública apenas como referência inicial. Para tomar uma
                    decisão de preço ou margem, confira o contrato e o Portal do Parceiro,
                    porque promoções, região e condições comerciais podem mudar a cobrança.
                </p>
                <p>
                    Se você estiver comparando o iFood com pedidos diretos, use a mesma base
                    de custos nos dois canais. Veja também {" "}
                    <Link href="/blog/quanto-ifood-cobra" className="font-semibold text-brand underline">
                        quanto o iFood cobra no mês
                    </Link>{" "}
                    e conheça um {" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand underline">
                        cardápio digital próprio
                    </Link>{" "}
                    para comparar recorrência e margem.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faWallet } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogSection,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("quanto-sobra-restaurante-ifood")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "quanto-sobra", label: "Quanto sobra" },
    { id: "formula", label: "Fórmula" },
    { id: "exemplo", label: "Exemplo por pedido" },
    { id: "liquido-nao-e-lucro", label: "Líquido x lucro" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Quanto sobra de um pedido do iFood para o restaurante?",
        answer:
            "Depende do plano, forma de pagamento, mensalidade e condições comerciais. Para estimar, subtraia comissão e taxa de pagamento do valor do pedido e depois rateie a mensalidade apenas se quiser medir o custo efetivo mensal.",
    },
    {
        question: "O valor líquido do iFood já é lucro?",
        answer:
            "Não. Depois das taxas da plataforma ainda existem ingredientes, embalagem, impostos, equipe, entrega própria e outros custos do restaurante.",
    },
    {
        question: "Como saber quanto cobrar no iFood para receber um valor líquido?",
        answer:
            "Use os percentuais reais do seu contrato e calcule o preço necessário para que o valor restante após as taxas alcance sua meta. A calculadora de taxas do iFood do iMenu faz essa conta.",
    },
];

export default function QuantoSobraRestauranteIfoodPage() {
    return (
        <BlogArticle
            article={article}
            icon={faWallet}
            takeaways={[
                "Como chegar ao valor líquido depois das taxas da plataforma",
                "Um exemplo simples por pedido",
                "Por que valor líquido e lucro do restaurante são coisas diferentes",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "taxa-ifood-para-restaurante",
                "comissao-ifood",
                "quanto-custa-vender-no-ifood",
            ]}
            ctaTitle="Receba também pedidos pelo seu próprio cardápio"
        >
            <BlogSection id="quanto-sobra" title="Quanto sobra para o restaurante no iFood">
                <p>
                    O valor que sobra depende das condições da sua loja. Para responder
                    corretamente, comece pelo valor do pedido e desconte apenas as cobranças
                    da plataforma que realmente se aplicam àquela venda.
                </p>
                <p>
                    Comissão, pagamento via iFood e mensalidade têm bases diferentes.
                    Por isso, somar percentuais e aplicar em todos os pedidos pode distorcer
                    o resultado.
                </p>
            </BlogSection>

            <BlogSection id="formula" title="Fórmula para calcular o líquido">
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="font-mono text-sm leading-7 sm:text-base">
                        líquido do pedido = venda − comissão − taxa de pagamento aplicável
                    </p>
                </div>
                <p>
                    Para avaliar o mês inteiro, some os pedidos e inclua a mensalidade
                    quando ela for devida. O guia de {" "}
                    <Link href="/blog/quanto-ifood-cobra" className="font-semibold text-brand underline">
                        quanto o iFood cobra
                    </Link>{" "}
                    mostra essa conta mensal completa.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-taxas-ifood"
                    title="Veja quanto sobra com suas taxas"
                    description="Informe as condições do seu contrato e veja valor líquido, custo total e preço necessário para atingir uma meta líquida."
                />
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo: pedido de R$ 50 pago via iFood">
                <p>
                    Usando como referência os percentuais da página oficial de planos
                    consultada em 7 de outubro de 2026, no Plano Básico a comissão de 12%
                    representa R$ 6 e a taxa de pagamento de 3,2% representa R$ 1,60.
                    O líquido antes da mensalidade e dos demais custos seria R$ 42,40.
                </p>
                <p>
                    No Plano Entrega, a comissão publicada de 23% representa R$ 11,50.
                    Com os mesmos R$ 1,60 de pagamento, o líquido seria R$ 36,90 antes da
                    mensalidade e dos outros custos.
                </p>
                <BlogCallout title="Use esse exemplo só como referência" variant="warning">
                    Outra página oficial do iFood mostrava 3,5% para pagamento na mesma
                    data. Confira seu contrato ou Portal do Parceiro e substitua o
                    percentual pelo valor real da sua loja.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="liquido-nao-e-lucro" title="O líquido do iFood ainda não é o lucro">
                <p>
                    Depois das taxas da plataforma, ainda é preciso pagar ingredientes,
                    embalagem, impostos, equipe, aluguel e outros custos. Se a loja faz a
                    própria entrega, esse custo também precisa entrar na análise.
                </p>
                <p>
                    Compare a margem final com um {" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand underline">
                        canal próprio de pedidos
                    </Link>{" "}
                    e use a diferença para decidir onde direcionar clientes recorrentes.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

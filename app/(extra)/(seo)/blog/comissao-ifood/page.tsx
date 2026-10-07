import Link from "next/link";
import { faPercent } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogSection,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("comissao-ifood")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "percentuais", label: "Comissão publicada" },
    { id: "como-calcular", label: "Como calcular" },
    { id: "comissao-nao-e-custo-total", label: "Comissão x custo total" },
    { id: "comparar", label: "Como comparar canais" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Qual é a comissão do iFood?",
        answer:
            "Nas condições padrão publicadas para restaurantes e consultadas em 7 de outubro de 2026, a comissão é de 12% no Plano Básico e 23% no Plano Entrega. Verifique seu contrato porque condições comerciais podem variar.",
    },
    {
        question: "A comissão do iFood já inclui a taxa de pagamento?",
        answer:
            "Não. A taxa para pedidos pagos via iFood é apresentada separadamente nas páginas oficiais. A mensalidade também é uma cobrança separada quando aplicável.",
    },
    {
        question: "Como calcular quanto a comissão tira de um pedido?",
        answer:
            "Multiplique o valor do pedido pelo percentual de comissão. Em um pedido de R$ 50, 12% representam R$ 6 e 23% representam R$ 11,50.",
    },
];

export default function ComissaoIfoodPage() {
    return (
        <BlogArticle
            article={article}
            icon={faPercent}
            takeaways={[
                "A comissão publicada dos planos Básico e Entrega",
                "Como transformar o percentual em reais por pedido",
                "Por que comissão e custo total do canal não são a mesma coisa",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "taxa-ifood-para-restaurante",
                "quanto-ifood-cobra",
                "quanto-sobra-restaurante-ifood",
            ]}
            ctaTitle="Tenha um canal próprio para comparar sua margem"
        >
            <BlogSection id="percentuais" title="Comissão do iFood: 12% ou 23%">
                <p>
                    Nas condições padrão publicadas para restaurantes, o
                    <strong> Plano Básico cobra 12%</strong> de comissão sobre pedidos
                    delivery e o <strong>Plano Entrega cobra 23%</strong>. A diferença
                    acompanha principalmente quem realiza a entrega.
                </p>
                <BlogCallout title="Seu contrato é a referência final" variant="warning">
                    Os percentuais públicos servem como referência. Promoções, negociações e
                    condições específicas da loja podem mudar o custo real.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-calcular" title="Como calcular a comissão do iFood por pedido">
                <p>
                    A conta da comissão é direta: multiplique o valor do pedido pelo
                    percentual do seu plano.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="font-mono text-sm leading-7 sm:text-base">
                        comissão = valor do pedido × percentual de comissão
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm font-semibold text-brand">Pedido de R$ 50 • Básico</p>
                        <p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 6,00</p>
                        <p className="mt-2 text-sm text-gray-600">R$ 50 × 12%</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
                        <p className="text-sm font-semibold text-brand">Pedido de R$ 50 • Entrega</p>
                        <p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 11,50</p>
                        <p className="mt-2 text-sm text-gray-600">R$ 50 × 23%</p>
                    </div>
                </div>
            </BlogSection>

            <BlogSection id="comissao-nao-e-custo-total" title="Comissão não é o custo total do iFood">
                <p>
                    Olhar apenas 12% ou 23% pode subestimar o custo do canal. Pedidos pagos
                    dentro da plataforma podem ter taxa de pagamento adicional, e a loja
                    pode ter mensalidade quando atinge o faturamento definido nas condições
                    do plano.
                </p>
                <p>
                    Para ver a composição completa, leia {" "}
                    <Link href="/blog/taxa-ifood-para-restaurante" className="font-semibold text-brand underline">
                        taxa do iFood para restaurante
                    </Link>{" "}
                    ou o guia de {" "}
                    <Link href="/blog/quanto-ifood-cobra" className="font-semibold text-brand underline">
                        quanto o iFood cobra
                    </Link>.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-comissao-delivery"
                    title="Calcule comissão e líquido por pedido"
                    description="Informe comissão, pagamento, custos fixos e entrega para comparar quanto sobra em diferentes canais."
                />
            </BlogSection>

            <BlogSection id="comparar" title="Compare comissão com margem, não só com faturamento">
                <p>
                    Uma comissão alta pode ainda fazer sentido se o canal trouxer pedidos
                    novos e margem positiva. Uma comissão menor também pode ser ruim se os
                    itens vendidos já tiverem margem apertada. Compare sempre o líquido por
                    pedido e a função do canal.
                </p>
                <p>
                    Para clientes recorrentes que já procuram sua marca, vale comparar com
                    um {" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand underline">
                        cardápio digital próprio
                    </Link>{" "}
                    e medir a diferença de margem sem desligar um canal que ainda gera
                    aquisição rentável.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

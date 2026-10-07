import Link from "next/link";
import { faReceipt } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogToolLink,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("quanto-custa-vender-no-ifood")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "custos", label: "Custos para vender" },
    { id: "fixos-variaveis", label: "Fixos e variáveis" },
    { id: "conta-mensal", label: "Conta mensal" },
    { id: "decidir", label: "Como decidir" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Quanto custa vender no iFood por mês?",
        answer:
            "O custo depende do faturamento, plano, parcela paga via iFood e condições da loja. Nas condições públicas consultadas em 7 de outubro de 2026, há comissão de 12% ou 23% e mensalidade de R$ 110 ou R$ 150 acima de R$ 1.800 de faturamento mensal, além da taxa de pagamento quando aplicável.",
    },
    {
        question: "Existe custo para começar no iFood?",
        answer:
            "O iFood pode oferecer promoções de entrada e mensalidades grátis por período. Como essas ofertas mudam, confira as condições exibidas no cadastro e no contrato da sua loja.",
    },
    {
        question: "Embalagem e entrega entram na taxa do iFood?",
        answer:
            "Nem sempre. Embalagem é custo operacional do restaurante. No Plano Básico, a entrega é responsabilidade da loja; no Plano Entrega, a logística é feita por parceiros do iFood e a comissão publicada é maior.",
    },
];

export default function QuantoCustaVenderNoIfoodPage() {
    return (
        <BlogArticle
            article={article}
            icon={faReceipt}
            takeaways={[
                "Quais custos da plataforma entram antes de calcular lucro",
                "Como separar despesas fixas e variáveis",
                "Uma conta mensal para comparar iFood e canal próprio",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "quanto-ifood-cobra",
                "taxa-ifood-para-restaurante",
                "ifood-vale-a-pena-restaurante",
            ]}
            ctaTitle="Compare o custo do iFood com pedidos diretos"
        >
            <BlogSection id="custos" title="Quanto custa vender no iFood">
                <p>
                    Para estimar o custo de vender no iFood, comece pelas cobranças da
                    plataforma e depois adicione os custos que continuam existindo no seu
                    restaurante. Isso evita comparar comissão com lucro e chegar a uma
                    conclusão errada.
                </p>
                <BlogChecklist
                    items={[
                        "Comissão do plano",
                        "Taxa de pagamento via iFood",
                        "Mensalidade quando aplicável",
                        "Ingredientes e embalagem",
                        "Impostos",
                        "Entrega própria ou subsídio de frete",
                        "Descontos bancados pelo restaurante",
                        "Outros custos variáveis do pedido",
                    ]}
                />
            </BlogSection>

            <BlogSection id="fixos-variaveis" title="Separe custos fixos e variáveis">
                <p>
                    Comissão e taxa de pagamento crescem com as vendas. A mensalidade é
                    um custo fixo do canal no mês quando a condição é atingida. Já
                    ingredientes, embalagem e imposto pertencem à operação e precisam ser
                    adicionados depois para chegar à margem real.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="font-mono text-sm leading-7 sm:text-base">
                        custo do canal = comissão + pagamento + mensalidade
                    </p>
                    <p className="mt-2 font-mono text-sm leading-7 sm:text-base">
                        margem = vendas − custo do canal − custos variáveis da operação
                    </p>
                </div>
            </BlogSection>

            <BlogSection id="conta-mensal" title="Faça a conta mensal com seus números">
                <p>
                    Uma loja que vende R$ 10.000 no mês não deve estimar o custo apenas
                    multiplicando o faturamento pela comissão. Parte dos pedidos pode ser
                    paga fora do aplicativo e a mensalidade precisa entrar apenas uma vez.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-taxas-ifood"
                    title="Simule o custo mensal do iFood"
                    description="Informe faturamento, pagamentos online, comissão e mensalidade para ver quanto custa o canal e quanto sobra."
                />
                <BlogCallout title="Evite copiar um percentual da internet" variant="warning">
                    Use os valores do seu contrato ou Portal do Parceiro. As páginas
                    oficiais consultadas em 7 de outubro de 2026 exibiam 3,2% e 3,5% em
                    páginas diferentes para a taxa de pagamento.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="decidir" title="Quando o custo faz sentido">
                <p>
                    O custo só é alto ou baixo em relação ao que o canal entrega. Se o iFood
                    traz clientes novos com margem positiva, ele pode funcionar como canal
                    de aquisição. Se clientes recorrentes já buscam sua marca diretamente,
                    um canal próprio pode preservar mais margem nessas compras.
                </p>
                <p>
                    Veja o guia {" "}
                    <Link href="/blog/ifood-vale-a-pena-restaurante" className="font-semibold text-brand underline">
                        iFood vale a pena para restaurante?
                    </Link>{" "}
                    e compare com um {" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand underline">
                        cardápio digital próprio
                    </Link>{" "}
                    antes de mudar preços ou desligar qualquer canal.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faLightbulb } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("ifood-vale-a-pena-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "resposta", label: "Resposta curta" },
    { id: "quando-vale", label: "Quando vale a pena" },
    { id: "quando-aperta", label: "Quando aperta a margem" },
    { id: "como-decidir", label: "Como decidir" },
    { id: "canal-proprio", label: "Canal próprio" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "iFood vale a pena para restaurante?",
        answer:
            "Pode valer quando o canal traz clientes, conveniência ou logística com margem positiva. A decisão depende do custo efetivo, da margem por pedido e da quantidade de clientes que o iFood gera e que você não teria de outra forma.",
    },
    {
        question: "É melhor sair do iFood e vender só pelo WhatsApp?",
        answer:
            "Não existe regra geral. Sair de uma vez pode eliminar uma fonte de descoberta. É mais seguro medir marketplace e canal próprio em paralelo antes de reduzir um canal que ainda é rentável.",
    },
    {
        question: "Como saber se o iFood está dando lucro?",
        answer:
            "Calcule a margem por pedido depois de comissão, pagamento, entrega, desconto, CMV, embalagem e impostos. Depois compare com pedidos diretos e acompanhe também quantos clientes novos cada canal traz.",
    },
];

export default function IfoodValeAPenaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faLightbulb}
            takeaways={[
                "Quando o marketplace pode justificar o custo",
                "Os sinais de que as taxas estão comprimindo a margem",
                "Um método para comparar iFood e canal próprio sem achismo",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "quanto-custa-vender-no-ifood",
                "quanto-ifood-cobra",
                "alternativa-ao-ifood",
            ]}
            ctaTitle="Construa um canal próprio sem abandonar o que funciona"
        >
            <BlogSection id="resposta" title="iFood vale a pena? A resposta curta">
                <p>
                    O iFood pode valer a pena quando entrega algo que compensa seu custo:
                    novos clientes, volume, conveniência de pagamento ou logística. O erro
                    é decidir olhando apenas a comissão ou apenas o faturamento.
                </p>
                <BlogCallout title="A pergunta certa é sobre margem incremental" variant="tip">
                    Compare quanto cada pedido deixa de margem e quantos desses pedidos
                    provavelmente não existiriam sem o marketplace.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="quando-vale" title="Quando o iFood tende a valer a pena">
                <BlogChecklist
                    items={[
                        "Traz clientes novos que ainda não conheciam a marca",
                        "Os pedidos continuam com margem positiva depois das taxas",
                        "A logística do plano resolve um gargalo real da operação",
                        "A loja consegue vender itens com boa margem e ticket",
                        "O canal gera volume adicional sem sobrecarregar a cozinha",
                        "A presença no app ajuda descoberta em uma região competitiva",
                    ]}
                />
            </BlogSection>

            <BlogSection id="quando-aperta" title="Quando o iFood pode apertar demais a margem">
                <p>
                    O sinal de alerta não é simplesmente “a taxa é alta”. É quando o
                    restaurante vende bastante, mas os pedidos deixam pouca contribuição
                    depois de comissão, pagamento, descontos, embalagem, CMV e entrega.
                </p>
                <p>
                    Antes de concluir, descubra {" "}
                    <Link href="/blog/quanto-sobra-restaurante-ifood" className="font-semibold text-brand underline">
                        quanto sobra por pedido
                    </Link>{" "}
                    e {" "}
                    <Link href="/blog/quanto-custa-vender-no-ifood" className="font-semibold text-brand underline">
                        quanto custa vender no iFood no mês
                    </Link>.
                </p>
            </BlogSection>

            <BlogSection id="como-decidir" title="Como decidir com números">
                <p>
                    Meça pelo menos três coisas por canal: margem por pedido, quantidade de
                    pedidos e proporção de clientes novos. Depois compare períodos
                    equivalentes para não confundir sazonalidade com efeito do canal.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-comissao-delivery"
                    title="Compare o líquido entre canais"
                    description="Simule comissão, pagamento, entrega e custos fixos por pedido para comparar marketplace e canal direto."
                />
            </BlogSection>

            <BlogSection id="canal-proprio" title="Canal próprio não precisa substituir o iFood">
                <p>
                    Uma estratégia comum é usar o marketplace para descoberta e ter um
                    canal próprio para clientes que já procuram diretamente o restaurante.
                    Assim você compara os dois papéis em vez de tratar a decisão como tudo
                    ou nada.
                </p>
                <p>
                    Veja como funciona um {" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand underline">
                        cardápio digital para receber pedidos diretamente
                    </Link>{" "}
                    e o guia de {" "}
                    <Link href="/blog/alternativa-ao-ifood" className="font-semibold text-brand underline">
                        alternativa ao iFood
                    </Link>{" "}
                    para montar esse teste sem desligar o marketplace.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

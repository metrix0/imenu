import Link from "next/link";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("como-criar-combo-no-delivery")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "bom-combo", label: "O que é um bom combo" },
    { id: "escolher-itens", label: "Escolher os itens" },
    { id: "calcular-preco", label: "Calcular o preço" },
    { id: "exemplo", label: "Exemplo completo" },
    { id: "formatos", label: "Formatos de combo" },
    { id: "publicar-testar", label: "Publicar e testar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como calcular o preço de um combo no delivery?",
        answer:
            "Some ingredientes, embalagem e outros custos fixos por combo; inclua taxas e impostos percentuais do canal; defina a margem mínima; e compare o preço calculado com a soma dos itens avulsos. O desconto só pode usar a margem disponível.",
    },
    {
        question: "Qual desconto dar em um combo?",
        answer:
            "Não existe percentual universal. O desconto deve ser menor que a contribuição disponível e ainda deixar uma vantagem perceptível. Às vezes conveniência, item exclusivo ou tamanho adequado cria valor sem um desconto grande.",
    },
    {
        question: "Combo aumenta o ticket médio?",
        answer:
            "Pode aumentar quando leva o cliente de uma compra parcial para uma solução completa. Para confirmar, acompanhe adesão, ticket, margem por pedido, conversão e possível queda nas vendas avulsas.",
    },
    {
        question: "Quais itens funcionam melhor em combos?",
        answer:
            "Itens consumidos juntos, com execução previsível e margens complementares. Principal, acompanhamento e bebida são uma estrutura comum, mas o melhor conjunto depende da ocasião e dos dados do restaurante.",
    },
];

export default function ComoCriarComboDeliveryPage() {
    return (
        <BlogArticle
            article={article}
            icon={faBoxesStacked}
            takeaways={[
                "Um critério para montar combinações que resolvem uma ocasião",
                "Uma fórmula de preço com custo, taxa e margem mínima",
                "Um roteiro de teste para medir adesão e canibalização",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-aumentar-ticket-medio-restaurante",
                "como-montar-cardapio-delivery",
                "quanto-ifood-cobra",
            ]}
            ctaTitle="Monte combos e adicionais no seu cardápio"
        >
            <BlogSection id="bom-combo" title="Um bom combo resolve uma ocasião — não apenas junta sobras">
                <p>
                    O cliente entende um combo rapidamente quando os itens pertencem à
                    mesma refeição, a quantidade está clara e existe uma vantagem. Para o
                    restaurante, ele precisa manter margem, viajar bem e não criar uma
                    sequência especial que atrasa a cozinha.
                </p>
                <BlogChecklist
                    items={[
                        "Os itens são naturalmente consumidos juntos",
                        "A quantidade atende uma ocasião identificável",
                        "A vantagem pode ser explicada em uma frase",
                        "O custo de todos os componentes está atualizado",
                        "A embalagem suporta o conjunto sem perda de qualidade",
                        "A montagem não cria um gargalo novo",
                    ]}
                />
                <BlogCallout title="Dê nome à ocasião" variant="tip">
                    “Combo casal”, “Almoço completo” ou “Lanche + acompanhamento” comunica
                    melhor que “Combo 7”. Use pessoas servidas somente quando a quantidade
                    realmente sustenta essa promessa.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="escolher-itens" title="Escolha itens que combinam no prato e na margem">
                <p>
                    Comece pelos pedidos reais. Descubra quais itens já aparecem juntos e
                    quais pedidos frequentemente saem incompletos. Depois verifique custo,
                    margem e impacto operacional de cada candidato.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Escolha um item principal",
                            description: "Use um produto conhecido, bem executado e com ficha técnica confiável. Ele dá identidade ao combo.",
                        },
                        {
                            title: "Complete a ocasião",
                            description: "Adicione acompanhamento, bebida, sobremesa ou quantidade adicional que torne a compra mais conveniente.",
                        },
                        {
                            title: "Equilibre margens",
                            description: "Um item de boa contribuição pode permitir vantagem no conjunto, desde que o total continue acima do piso definido.",
                        },
                        {
                            title: "Teste a produção",
                            description: "Cronometre separação, preparo e embalagem em horário movimentado. Combo bom no papel pode ser ruim na expedição.",
                        },
                        {
                            title: "Teste a viagem",
                            description: "Itens quentes e frios, crocantes e úmidos ou bebidas e comida podem exigir compartimentos separados.",
                        },
                    ]}
                />
                <BlogSubheading>Não use produto encalhado como única razão</BlogSubheading>
                <p>
                    Um item de baixa procura pode estar mal apresentado — ou pode ser algo
                    que o cliente não quer. Colocá-lo em um combo sem investigar transfere o
                    problema e pode reduzir a atratividade do produto principal.
                </p>
            </BlogSection>

            <BlogSection id="calcular-preco" title="Como calcular o preço mínimo do combo">
                <p>
                    Separe custos em reais e custos percentuais. Ingredientes e embalagem
                    entram em reais por combo. Comissão, pagamento e alguns impostos podem
                    incidir como percentual do preço de venda.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Preço para uma margem-alvo</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        preço = custos em reais ÷ (1 − taxas percentuais − margem-alvo)
                    </p>
                </div>
                <p>
                    Se os custos em reais somam R$ 15,20, as taxas variáveis somam 3,2% e
                    a meta de margem de contribuição é 50%, o piso matemático é:
                    R$ 15,20 ÷ (1 − 0,032 − 0,50) = R$ 32,48.
                </p>
                <BlogCallout title="O piso não define sozinho o preço final" variant="info">
                    Depois da conta, avalie soma dos itens avulsos, percepção de valor,
                    quantidade, preços do mercado e posicionamento. A fórmula impede vender
                    abaixo da meta; ela não substitui a decisão comercial.
                </BlogCallout>
                <BlogChecklist
                    items={[
                        "Ingredientes de todos os itens",
                        "Molhos, descartáveis e brindes incluídos",
                        "Embalagem principal e secundária",
                        "Comissão do canal",
                        "Taxa de pagamento",
                        "Imposto variável aplicável",
                        "Subsídio de entrega ou promoção",
                        "Perdas médias diretamente ligadas ao pedido",
                    ]}
                />
                <BlogToolLink
                    href="/ferramentas/calculadora-preco-combo"
                    title="Calcule o preço do combo"
                    description="Adicione componentes, taxas, margem e desconto para ver custo, preço sugerido e contribuição por venda."
                />
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo completo: combo de hambúrguer, fritas e bebida">
                <p>
                    Considere itens vendidos separadamente por R$ 24, R$ 10 e R$ 6. A soma
                    avulsa é R$ 40. Os ingredientes custam R$ 8,50, R$ 3 e R$ 1,50; a
                    embalagem do conjunto custa R$ 2,20.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[650px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Componente</th>
                                <th className="px-5 py-4 font-bold">Preço avulso</th>
                                <th className="px-5 py-4 font-bold">Custo no combo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Hambúrguer</td><td className="px-5 py-4">R$ 24,00</td><td className="px-5 py-4">R$ 8,50</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Fritas</td><td className="px-5 py-4">R$ 10,00</td><td className="px-5 py-4">R$ 3,00</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Bebida</td><td className="px-5 py-4">R$ 6,00</td><td className="px-5 py-4">R$ 1,50</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Embalagem do conjunto</td><td className="px-5 py-4">—</td><td className="px-5 py-4">R$ 2,20</td></tr>
                            <tr className="bg-gray-50"><td className="px-5 py-4 font-bold text-gray-950">Total</td><td className="px-5 py-4 font-bold text-gray-950">R$ 40,00</td><td className="px-5 py-4 font-bold text-gray-950">R$ 15,20</td></tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Um preço de combo de R$ 36,90 oferece R$ 3,10 de vantagem, ou 7,75%
                    sobre a soma avulsa. Em um canal com taxa de pagamento de 3,2%, o custo
                    dessa taxa seria aproximadamente R$ 1,18. A contribuição antes de
                    imposto, entrega e outros custos seria R$ 20,52.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">Preço do combo</p><p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 36,90</p></div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">Custo + pagamento</p><p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 16,38</p></div>
                    <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5"><p className="text-sm text-gray-500">Contribuição parcial</p><p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 20,52</p></div>
                </div>
                <BlogCallout title="Recalcule para cada canal" variant="warning">
                    Se o mesmo combo for vendido em um marketplace com comissão, a taxa
                    adicional reduz a contribuição. Inclua contrato, imposto, promoção,
                    entrega e mensalidade alocada quando forem relevantes para a decisão.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="formatos" title="Quatro formatos de combo e quando usar">
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        { title: "Refeição completa", text: "Principal + acompanhamento + bebida. Bom para reduzir a dúvida de quem quer resolver uma refeição individual." },
                        { title: "Para compartilhar", text: "Quantidade explícita para duas ou mais pessoas. Inclua porções e volume, não apenas a palavra “família”." },
                        { title: "Escolha dentro de limites", text: "Cliente escolhe um item de cada grupo. Mantenha opções equivalentes em custo ou cobre diferença visível." },
                        { title: "Produto + upgrade", text: "Parte de uma versão básica e oferece tamanho, proteína ou complemento superior por uma diferença clara." },
                    ].map((format) => (
                        <div key={format.title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{format.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{format.text}</p>
                        </div>
                    ))}
                </div>
                <BlogSubheading>Como escrever a oferta</BlogSubheading>
                <p>
                    Nomeie a ocasião, liste tudo que vem, informe quantidade ou tamanho,
                    mostre as escolhas e exiba preço do combo. Se houver economia real,
                    mostre em reais: “itens separados R$ 40; no combo R$ 36,90”.
                </p>
            </BlogSection>

            <BlogSection id="publicar-testar" title="Publique como experimento e acompanhe o efeito completo">
                <BlogSteps
                    items={[
                        {
                            title: "Registre duas a quatro semanas de base",
                            description: "Anote pedidos, ticket, margem, itens avulsos e tempo de preparo antes do combo.",
                        },
                        {
                            title: "Lance em um canal ou período definido",
                            description: "Isso facilita comparar sem misturar mudanças de preço, promoção e exposição em todos os lugares.",
                        },
                        {
                            title: "Meça adesão e substituição",
                            description: "Veja quantos compram o combo e quantos apenas trocaram uma compra avulsa mais rentável.",
                        },
                        {
                            title: "Observe a cozinha e a entrega",
                            description: "Registre tempo adicional, falta de componentes, erros de montagem e qualidade ao chegar.",
                        },
                        {
                            title: "Decida com margem total",
                            description: "Mantenha, ajuste preço ou composição, ou remova. Popularidade sem contribuição não basta.",
                        },
                    ]}
                />
                <BlogChecklist
                    items={[
                        "Percentual de pedidos com combo",
                        "Ticket médio antes e depois",
                        "Margem de contribuição por pedido",
                        "Venda perdida dos itens avulsos",
                        "Tempo de preparo e expedição",
                        "Erros, cancelamentos e reclamações",
                    ]}
                />
                <p>
                    Para conectar o teste ao resultado geral, use também o guia de {" "}
                    <Link href="/blog/como-aumentar-ticket-medio-restaurante" className="font-semibold text-brand underline">
                        como aumentar o ticket médio do restaurante
                    </Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

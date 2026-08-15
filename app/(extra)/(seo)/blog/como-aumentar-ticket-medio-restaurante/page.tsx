import Link from "next/link";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("como-aumentar-ticket-medio-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "calcular", label: "Calcular corretamente" },
    { id: "meta", label: "Definir a meta" },
    { id: "estrategias", label: "Estratégias práticas" },
    { id: "exemplo", label: "Exemplo completo" },
    { id: "plano-testes", label: "Plano de testes" },
    { id: "erros", label: "Erros a evitar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como calcular o ticket médio de um restaurante?",
        answer:
            "Divida o faturamento do período pela quantidade de pedidos do mesmo período. Para delivery, use pedidos; para salão, escolha comandas ou clientes e mantenha o critério igual nas comparações.",
    },
    {
        question: "Como aumentar o ticket médio sem aumentar todos os preços?",
        answer:
            "Facilite a inclusão de complementos relevantes, crie combos com margem conhecida, ofereça tamanhos ou versões e destaque bebidas, acompanhamentos e sobremesas no momento certo da decisão.",
    },
    {
        question: "Ticket médio maior sempre significa mais lucro?",
        answer:
            "Não. Se o aumento vier de desconto excessivo, frete subsidiado ou item com custo alto, o faturamento pode subir enquanto a margem piora. Acompanhe ticket e margem de contribuição juntos.",
    },
    {
        question: "Qual é um bom ticket médio para restaurante?",
        answer:
            "Não existe valor universal. Compare com o próprio histórico, separado por canal, turno e tipo de pedido. Uma meta útil melhora o resultado sem reduzir conversão, margem ou frequência de compra.",
    },
];

export default function ComoAumentarTicketMedioPage() {
    return (
        <BlogArticle
            article={article}
            icon={faChartLine}
            takeaways={[
                "Uma linha de base confiável por canal e período",
                "Estratégias que elevam o pedido sem esconder o custo",
                "Um plano de testes que mede ticket, margem e conversão",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-criar-combo-no-delivery",
                "como-montar-cardapio-delivery",
                "quanto-ifood-cobra",
            ]}
            ctaTitle="Use o cardápio para vender o pedido completo"
        >
            <BlogSection id="calcular" title="Calcule o ticket médio com uma base comparável">
                <p>
                    No delivery, ticket médio é o faturamento dividido pelo número de
                    pedidos do mesmo período. Não misture pedidos cancelados, canais com
                    taxas diferentes ou períodos incompletos sem identificá-los.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Fórmula</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        ticket médio = faturamento dos pedidos concluídos ÷ número de pedidos concluídos
                    </p>
                </div>
                <p>
                    Exemplo: R$ 32.000 em 800 pedidos concluídos produz ticket médio de
                    R$ 40. Se 20 pedidos foram cancelados e não estão no faturamento, eles
                    também não entram no denominador.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-ticket-medio"
                    title="Calcule e compare seu ticket médio"
                    description="Informe faturamento e pedidos de dois períodos para ver valor, variação e impacto estimado."
                />
                <BlogSubheading>Separe antes de comparar</BlogSubheading>
                <BlogChecklist
                    items={[
                        "Delivery, salão, retirada e balcão",
                        "Canal próprio e cada marketplace",
                        "Almoço, jantar e madrugada",
                        "Dias úteis e fim de semana",
                        "Pedidos com e sem promoção",
                        "Primeira compra e recompra, quando identificável",
                    ]}
                />
                <BlogCallout title="Ticket é uma média, não um diagnóstico" variant="info">
                    Dois restaurantes podem ter ticket de R$ 50: um vende pratos individuais
                    e outro vende pedidos para duas pessoas. Leia ticket junto com itens por
                    pedido, margem, conversão e perfil da ocasião.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="meta" title="Defina uma meta que proteja conversão e margem">
                <p>
                    A meta não deve ser “aumentar o máximo possível”. Deve ser elevar o
                    valor do pedido com uma proposta que o cliente considera útil e que a
                    cozinha consegue entregar com margem.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Escolha uma base",
                            description: "Use ao menos quatro semanas recentes e separe eventos atípicos, feriados e campanhas grandes.",
                        },
                        {
                            title: "Encontre o pedido incompleto",
                            description: "Veja quantos pedidos saem sem bebida, acompanhamento ou outro item que normalmente faria sentido.",
                        },
                        {
                            title: "Calcule a contribuição do complemento",
                            description: "Preço adicional menos custo variável adicional. Essa é a parte que ajuda a pagar os custos fixos e o lucro.",
                        },
                        {
                            title: "Defina uma mudança pequena",
                            description: "Por exemplo: elevar R$ 2 no ticket médio do jantar sem reduzir conversão ou margem percentual além do limite definido.",
                        },
                    ]}
                />
            </BlogSection>

            <BlogSection id="estrategias" title="Oito estratégias para aumentar o ticket médio com utilidade">
                <div className="space-y-5">
                    {[
                        {
                            number: "01",
                            title: "Combos que resolvem uma refeição",
                            text: "Agrupe itens comprados juntos e ofereça uma vantagem menor que a soma das margens disponíveis. Mostre o que vem e a economia em reais.",
                        },
                        {
                            number: "02",
                            title: "Complementos contextuais",
                            text: "Sugira bebida após o principal, molho depois da porção e sobremesa ao final. A sugestão precisa combinar com o item, não aparecer em todo pedido.",
                        },
                        {
                            number: "03",
                            title: "Versões simples, completas e para compartilhar",
                            text: "Tamanhos ou versões atendem ocasiões diferentes. Diga a diferença de quantidade e preço para a escolha não parecer arbitrária.",
                        },
                        {
                            number: "04",
                            title: "Adicionais de execução simples",
                            text: "Ingrediente extra, proteína, molho ou acompanhamento pode elevar o pedido quando tem custo conhecido e não cria gargalo na cozinha.",
                        },
                        {
                            number: "05",
                            title: "Categorias de bebidas e sobremesas fáceis de encontrar",
                            text: "O cliente não adiciona o que não encontra. Posicione essas categorias depois dos principais e use fotos reais nos itens de maior potencial.",
                        },
                        {
                            number: "06",
                            title: "Pedido para duas ou mais pessoas",
                            text: "Crie soluções com quantidades explícitas para casal, família ou equipe. Isso reduz o esforço de montar vários itens separadamente.",
                        },
                        {
                            number: "07",
                            title: "Benefício acima de uma faixa calculada",
                            text: "Frete reduzido, brinde ou condição especial pode estimular um item extra, mas a margem incremental precisa pagar o benefício.",
                        },
                        {
                            number: "08",
                            title: "Destaque para itens populares e rentáveis",
                            text: "Use dados para ordenar e destacar. Um item muito vendido com margem ruim precisa ser corrigido antes de receber mais tráfego.",
                        },
                    ].map((strategy) => (
                        <div key={strategy.number} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5">
                            <span className="text-2xl font-extrabold text-brand/35">{strategy.number}</span>
                            <div>
                                <h3 className="font-bold text-gray-950">{strategy.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-gray-600">{strategy.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <BlogCallout title="Frete grátis não é grátis para a operação" variant="warning">
                    Se o cliente adiciona R$ 10 ao pedido para ganhar R$ 8 de frete, o que
                    importa é a margem dos R$ 10 adicionais. Se ela for menor que o subsídio,
                    o ticket sobe e o resultado piora.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo: subir o ticket de R$ 40 para R$ 44">
                <p>
                    Uma operação faz 800 pedidos por mês a R$ 40, totalizando R$ 32.000. Se
                    o volume continuar igual e o ticket subir para R$ 44, o faturamento
                    passa a R$ 35.200: aumento de R$ 3.200.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm text-gray-500">Antes</p>
                        <p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 40</p>
                        <p className="mt-1 text-sm text-gray-600">800 pedidos · R$ 32 mil</p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
                        <p className="text-sm text-gray-500">Depois</p>
                        <p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 44</p>
                        <p className="mt-1 text-sm text-gray-600">800 pedidos · R$ 35,2 mil</p>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
                        <p className="text-sm text-gray-500">Receita adicional</p>
                        <p className="mt-2 text-2xl font-extrabold text-gray-950">R$ 3.200</p>
                        <p className="mt-1 text-sm text-gray-600">antes do custo adicional</p>
                    </div>
                </div>
                <p>
                    Agora inclua o custo. Se os R$ 4 adicionais médios vêm de complementos
                    que custam R$ 1,20, a contribuição adicional média é R$ 2,80. Em 800
                    pedidos, seriam R$ 2.240 antes de outros custos variáveis e possíveis
                    mudanças em conversão ou volume.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="font-mono text-sm leading-7 sm:text-base">
                        contribuição adicional = (R$ 4,00 − R$ 1,20) × 800 = R$ 2.240
                    </p>
                </div>
                <p>
                    Esse segundo cálculo impede comemorar faturamento que veio quase todo
                    acompanhado de custo ou desconto.
                </p>
            </BlogSection>

            <BlogSection id="plano-testes" title="Plano de quatro semanas para testar sem bagunçar o cardápio">
                <BlogSteps
                    items={[
                        {
                            title: "Semana 0: registrar a linha de base",
                            description: "Separe ticket, pedidos, conversão, margem e itens por pedido por canal e turno.",
                        },
                        {
                            title: "Semana 1: testar uma sugestão",
                            description: "Escolha um complemento de boa margem e mostre somente após um principal compatível.",
                        },
                        {
                            title: "Semana 2: medir comportamento",
                            description: "Compare aceitação, ticket, margem, conversão e tempo de produção com dias equivalentes.",
                        },
                        {
                            title: "Semana 3: ajustar apresentação ou oferta",
                            description: "Mude apenas um elemento: nome, posição, foto, preço ou composição. Evite alterar tudo junto.",
                        },
                        {
                            title: "Semana 4: manter, iterar ou remover",
                            description: "Mantenha se há contribuição incremental e operação saudável; ajuste se há sinal; remova se só cria fricção.",
                        },
                    ]}
                />
                <BlogChecklist
                    items={[
                        "Ticket médio",
                        "Margem de contribuição por pedido",
                        "Conversão em pedido",
                        "Itens por pedido",
                        "Taxa de aceitação da sugestão",
                        "Tempo de preparo",
                        "Cancelamento e reclamação",
                        "Frequência de recompra",
                    ]}
                />
            </BlogSection>

            <BlogSection id="erros" title="Erros que aumentam o ticket e diminuem o resultado">
                <BlogChecklist
                    items={[
                        "Dar desconto sem conhecer o custo do combo",
                        "Definir pedido mínimo acima do que o público aceita",
                        "Oferecer o mesmo adicional em qualquer contexto",
                        "Criar tantas opções que a cozinha perde padrão",
                        "Subsidiar frete com margem menor que o benefício",
                        "Comparar períodos com campanhas e dias diferentes",
                        "Medir faturamento sem margem de contribuição",
                        "Manter uma oferta que reduz conversão total",
                    ]}
                />
                <p>
                    Para transformar a estratégia mais comum em uma oferta calculada, veja {" "}
                    <Link href="/blog/como-criar-combo-no-delivery" className="font-semibold text-brand underline">
                        como criar combos lucrativos no delivery
                    </Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faUtensils } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("como-montar-cardapio-delivery")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "antes-dos-produtos", label: "Antes dos produtos" },
    { id: "escolher-mix", label: "Escolher o mix" },
    { id: "categorias", label: "Organizar categorias" },
    { id: "precos", label: "Calcular preços" },
    { id: "nomes-descricoes", label: "Nomes e descrições" },
    { id: "fotos-adicionais", label: "Fotos e adicionais" },
    { id: "teste-final", label: "Teste final" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como montar um cardápio de delivery do zero?",
        answer:
            "Defina primeiro área, prazo, capacidade e embalagem. Depois escolha itens que viajam bem, calcule custos e margem, organize categorias na ordem de compra, escreva descrições objetivas, configure adicionais e faça pedidos de teste antes de divulgar.",
    },
    {
        question: "Quantos itens um cardápio de delivery deve ter?",
        answer:
            "Não existe número universal. O cardápio deve oferecer escolha suficiente sem ultrapassar a capacidade de manter padrão, estoque e tempo de preparo. Comece com o mix que a operação executa bem e amplie usando dados de venda e margem.",
    },
    {
        question: "Como calcular o preço de um prato no delivery?",
        answer:
            "Some ingredientes, embalagem e demais custos variáveis do item; considere taxas do canal, impostos e margem desejada. Valide também tamanho da porção, percepção de valor e preços do mercado, sem usar o concorrente como substituto da própria ficha técnica.",
    },
    {
        question: "O que não pode faltar na descrição de um produto?",
        answer:
            "Diga o que é, ingredientes principais, quantidade ou tamanho quando relevante, acompanhamentos incluídos, escolhas obrigatórias e alertas importantes. A descrição deve reduzir dúvida, não apenas usar adjetivos.",
    },
];

export default function ComoMontarCardapioDeliveryPage() {
    return (
        <BlogArticle
            article={article}
            icon={faUtensils}
            takeaways={[
                "Um método para selecionar itens com demanda, margem e capacidade",
                "Uma estrutura de categorias que acompanha a decisão do cliente",
                "Um checklist completo para testar antes de publicar",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-criar-combo-no-delivery",
                "como-aumentar-ticket-medio-restaurante",
                "como-vender-delivery-pelo-whatsapp",
            ]}
            ctaTitle="Publique seu cardápio e comece a receber pedidos"
        >
            <BlogSection id="antes-dos-produtos" title="Antes de escolher os produtos, defina a promessa operacional">
                <p>
                    Um cardápio de delivery não é a lista completa do que a cozinha sabe
                    fazer. É a seleção do que o restaurante consegue preparar, embalar e
                    entregar com qualidade dentro de uma promessa clara.
                </p>
                <BlogChecklist
                    items={[
                        "Área atendida e tempo médio de deslocamento",
                        "Prazo realista nos horários de pico",
                        "Capacidade de produção por faixa de horário",
                        "Itens que mantêm textura e temperatura no trajeto",
                        "Embalagem disponível e custo por pedido",
                        "Pedido mínimo, taxa e regras de retirada",
                        "Canais onde o mesmo cardápio será vendido",
                        "Responsável por disponibilidade e preços",
                    ]}
                />
                <BlogCallout title="Faça o teste da viagem" variant="tip">
                    Prepare o item, embale como em um pedido real, espere o maior tempo
                    típico de entrega e só então abra. Avalie temperatura, umidade, vazamento,
                    montagem e aparência. Se o produto não chega bem, ajuste antes de vender.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="escolher-mix" title="Como escolher o mix sem depender de opinião">
                <p>
                    Liste os candidatos e avalie cada um por quatro critérios: procura,
                    margem de contribuição, estabilidade no transporte e complexidade
                    operacional. Um item popular que atrasa toda a cozinha pode custar mais
                    do que aparenta.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Item</th>
                                <th className="px-5 py-4 font-bold">Procura</th>
                                <th className="px-5 py-4 font-bold">Margem</th>
                                <th className="px-5 py-4 font-bold">Viaja bem?</th>
                                <th className="px-5 py-4 font-bold">Complexidade</th>
                                <th className="px-5 py-4 font-bold">Decisão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Mais vendido e rentável</td>
                                <td className="px-5 py-4">Alta</td><td className="px-5 py-4">Alta</td><td className="px-5 py-4">Sim</td><td className="px-5 py-4">Baixa/média</td><td className="px-5 py-4">Destacar</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Popular com margem baixa</td>
                                <td className="px-5 py-4">Alta</td><td className="px-5 py-4">Baixa</td><td className="px-5 py-4">Sim</td><td className="px-5 py-4">Média</td><td className="px-5 py-4">Reprecificar ou redesenhar</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Rentável pouco conhecido</td>
                                <td className="px-5 py-4">Baixa</td><td className="px-5 py-4">Alta</td><td className="px-5 py-4">Sim</td><td className="px-5 py-4">Baixa</td><td className="px-5 py-4">Melhorar nome, foto e posição</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Baixa procura e baixa margem</td>
                                <td className="px-5 py-4">Baixa</td><td className="px-5 py-4">Baixa</td><td className="px-5 py-4">Variável</td><td className="px-5 py-4">Alta</td><td className="px-5 py-4">Remover ou reformular</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogSubheading>Comece enxuto, mas cubra a ocasião de compra</BlogSubheading>
                <p>
                    O cliente precisa encontrar uma solução completa: principal, opção de
                    acompanhamento, bebida e, quando fizer sentido, sobremesa. Isso não
                    exige dezenas de variações. Exige que as escolhas essenciais estejam
                    disponíveis e que a cozinha consiga executá-las.
                </p>
            </BlogSection>

            <BlogSection id="categorias" title="Organize categorias na ordem em que o cliente decide">
                <p>
                    A arquitetura depende do negócio, mas deve responder rápido: “o que
                    vocês vendem?”, “qual é o mais pedido?”, “o que acompanha?” e “como
                    completo minha refeição?”. Evite categorias internas como “Cozinha 1”
                    ou “Fornecedor B”.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="font-bold text-gray-950">Exemplo: hamburgueria</p>
                        <ol className="mt-4 space-y-2 text-sm text-gray-600">
                            <li>1. Mais pedidos</li>
                            <li>2. Combos</li>
                            <li>3. Hambúrgueres</li>
                            <li>4. Acompanhamentos</li>
                            <li>5. Bebidas</li>
                            <li>6. Sobremesas</li>
                        </ol>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="font-bold text-gray-950">Exemplo: almoço</p>
                        <ol className="mt-4 space-y-2 text-sm text-gray-600">
                            <li>1. Pratos do dia</li>
                            <li>2. Monte seu prato</li>
                            <li>3. Opções vegetarianas</li>
                            <li>4. Porções e extras</li>
                            <li>5. Bebidas</li>
                            <li>6. Sobremesas</li>
                        </ol>
                    </div>
                </div>
                <BlogCallout title="“Mais pedidos” só deve conter mais pedidos" variant="info">
                    Use dados de venda, não conveniência comercial. Uma categoria confiável
                    ajuda quem está indeciso; uma categoria cheia de itens patrocinados
                    perde essa função.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="precos" title="Calcule o preço antes de decidir desconto, combo ou destaque">
                <p>
                    O preço precisa pagar o produto vendido e os custos que variam com o
                    pedido. Comece pela ficha técnica: quantidade usada, custo atualizado e
                    rendimento real de cada ingrediente.
                </p>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white">
                    <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">Base da conta</p>
                    <p className="mt-3 font-mono text-sm leading-7 sm:text-base">
                        margem de contribuição = preço − ingredientes − embalagem − taxas variáveis − imposto variável − subsídio de entrega
                    </p>
                </div>
                <BlogSubheading>Exemplo simples</BlogSubheading>
                <p>
                    Um prato vendido por R$ 32 tem R$ 9,50 de ingredientes, R$ 1,80 de
                    embalagem, R$ 1,28 de taxa de pagamento e R$ 1,92 de imposto variável.
                    Antes de custos fixos e entrega, sobram R$ 17,50 de margem de
                    contribuição. Se um canal ainda cobrar comissão, ela precisa entrar na
                    mesma conta.
                </p>
                <BlogCallout title="Preço do concorrente é referência, não fórmula" variant="warning">
                    Você não conhece porção, compra, desperdício, imposto, contrato ou
                    estrutura do concorrente. Use o mercado para validar percepção de valor,
                    mas use seus números para definir o piso.
                </BlogCallout>
                <BlogToolLink
                    href="/ferramentas/calculadora-preco-de-venda"
                    title="Calcule preço de venda e food cost"
                    description="Teste custo, despesas variáveis e margem desejada com a fórmula aberta e campos ajustáveis."
                />
            </BlogSection>

            <BlogSection id="nomes-descricoes" title="Nomes e descrições que reduzem dúvida e ajudam a escolher">
                <p>
                    O nome identifica rápido. A descrição completa o que não cabe no nome.
                    Antes de adjetivos, informe o que vem, quanto vem e quais escolhas o
                    cliente precisa fazer.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
                        <p className="text-sm font-semibold text-red-700">Vago</p>
                        <p className="mt-2 font-bold text-gray-950">X-Bacon Especial</p>
                        <p className="mt-2 text-sm text-gray-600">Delicioso lanche artesanal com muito sabor.</p>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
                        <p className="text-sm font-semibold text-green-700">Útil</p>
                        <p className="mt-2 font-bold text-gray-950">X-Bacon da Casa — 160 g</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">Hambúrguer bovino de 160 g, queijo, bacon crocante, alface, tomate e maionese da casa no pão brioche.</p>
                    </div>
                </div>
                <BlogChecklist
                    items={[
                        "Tipo de prato ou base principal",
                        "Ingredientes que definem a escolha",
                        "Peso, volume, unidades ou pessoas servidas",
                        "Acompanhamentos já incluídos",
                        "Molhos e itens enviados à parte",
                        "Escolhas obrigatórias e limites",
                        "Informação relevante de preparo",
                        "Alérgenos e restrições que a operação consegue afirmar com segurança",
                    ]}
                />
                <BlogToolLink
                    href="/ferramentas/gerador-descricao-produto-ia"
                    title="Crie um primeiro rascunho de descrição"
                    description="Gere uma versão em português e revise ingredientes, quantidade e promessas antes de publicar."
                />
            </BlogSection>

            <BlogSection id="fotos-adicionais" title="Fotos, adicionais e escolhas: onde muitos pedidos dão errado">
                <BlogSubheading>Fotos</BlogSubheading>
                <p>
                    Fotografe o produto que o cliente realmente recebe. Mantenha ângulo,
                    luz, fundo e enquadramento consistentes. Não use imagem de uma porção
                    maior sem deixar claro o tamanho. Uma boa foto alinha expectativa; uma
                    foto enganosa aumenta reclamação.
                </p>
                <BlogSubheading>Adicionais</BlogSubheading>
                <p>
                    Agrupe escolhas pela decisão: tamanho, ponto, sabor, acompanhamento,
                    adicionais e remoções. Marque o que é obrigatório, limite quantidades e
                    mostre o acréscimo de preço. Não transforme ingrediente essencial em
                    uma sequência cansativa de cliques.
                </p>
                <BlogChecklist
                    items={[
                        "A opção padrão produz um pedido completo",
                        "Obrigatórios realmente precisam ser escolhidos",
                        "Limites impedem combinações inviáveis",
                        "Preço adicional aparece antes da confirmação",
                        "Remoções não geram ambiguidade para a cozinha",
                        "Observação livre é usada só para exceções possíveis",
                    ]}
                />
                <p>
                    Para elevar o pedido sem confundir o cliente, use o guia de {" "}
                    <Link href="/blog/como-criar-combo-no-delivery" className="font-semibold text-brand underline">
                        como criar combos no delivery
                    </Link>.
                </p>
            </BlogSection>

            <BlogSection id="teste-final" title="Checklist de lançamento: faça um pedido como cliente">
                <BlogSteps
                    items={[
                        {
                            title: "Teste no celular com internet móvel",
                            description: "Abra pelo link público, navegue por todas as categorias e confira se imagens e preços carregam sem depender do Wi-Fi da loja.",
                        },
                        {
                            title: "Monte três pedidos diferentes",
                            description: "Faça um pedido simples, um com muitos adicionais e um de valor alto. Confira total, limites e observações.",
                        },
                        {
                            title: "Simule entrega e retirada",
                            description: "Valide taxa, endereço, prazo, pagamento e instruções específicas de cada modalidade.",
                        },
                        {
                            title: "Envie para a operação",
                            description: "Confirme se atendimento e cozinha entendem cada item sem perguntar ao cliente novamente.",
                        },
                        {
                            title: "Abra a embalagem no prazo real",
                            description: "Verifique temperatura, textura, vazamento, identificação e se todos os complementos chegaram.",
                        },
                        {
                            title: "Corrija antes de divulgar",
                            description: "Ajuste nome, descrição, foto, preço, limite ou embalagem. Repita o teste na parte alterada.",
                        },
                    ]}
                />
                <BlogCallout title="O cardápio nunca termina" variant="info">
                    A cada mês, revise disponibilidade, margem, reclamações, itens sem venda
                    e perguntas recorrentes. O melhor cardápio é o que fica mais simples e
                    confiável conforme aprende com os pedidos.
                </BlogCallout>
            </BlogSection>
        </BlogArticle>
    );
}

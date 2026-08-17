import { faGift } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("programa-fidelidade-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "como-funciona", label: "Como funciona" },
    { id: "recompensa", label: "Escolher recompensa" },
    { id: "meta", label: "Meta de pedidos" },
    { id: "configurar", label: "Como configurar" },
    { id: "divulgar", label: "Como divulgar" },
    { id: "erros", label: "Erros comuns" },
    { id: "metricas", label: "O que medir" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como funciona um programa de fidelidade para restaurante?",
        answer:
            "O cliente acumula progresso a cada pedido elegível e, ao atingir a meta definida, pode resgatar uma recompensa. O restaurante escolhe a regra, o prêmio e, quando necessário, um valor mínimo por pedido.",
    },
    {
        question: "Quantos pedidos devo exigir para dar uma recompensa?",
        answer:
            "Depende do ticket e do custo do prêmio. A meta precisa parecer alcançável para o cliente e continuar sustentável para o restaurante. Um teste comum é começar com uma meta simples e acompanhar a taxa de resgate.",
    },
    {
        question: "Posso definir um valor mínimo para o pedido contar?",
        answer:
            "Sim. No programa de fidelidade do iMenu é possível definir um valor mínimo. Pedidos concluídos abaixo desse valor não precisam gerar progresso no programa.",
    },
    {
        question: "A recompensa pode incluir complementos?",
        answer:
            "Sim. No iMenu o restaurante escolhe um item principal gratuito e pode definir quais complementos daquele item já vêm incluídos na recompensa.",
    },
];

export default function ProgramaFidelidadeRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faGift}
            takeaways={[
                "Uma regra simples para transformar recompra em uma meta visível",
                "Um método para escolher recompensa sem ignorar custo e margem",
                "Um checklist para configurar e divulgar o programa no restaurante",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-aumentar-ticket-medio-restaurante",
                "como-vender-delivery-pelo-whatsapp",
                "robo-whatsapp-para-restaurante",
            ]}
            ctaTitle="Crie uma recompensa simples para incentivar o próximo pedido"
        >
            <BlogSection id="como-funciona" title="Programa de fidelidade para restaurante precisa ser simples de entender">
                <p>
                    Fidelidade funciona melhor quando o cliente entende a regra sem fazer
                    conta. Um modelo direto é: <strong>cada pedido elegível conta um selo;
                    ao completar a meta, existe uma recompensa definida</strong>.
                </p>
                <p>
                    Esse formato evita pontos abstratos e cria uma meta concreta. O cliente
                    sabe quantas compras faltam e o restaurante consegue controlar o custo
                    do prêmio com antecedência.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Restaurante define a meta",
                            description: "Escolha quantos pedidos elegíveis o cliente precisa concluir para liberar o prêmio.",
                        },
                        {
                            title: "Cliente faz pedidos",
                            description: "Pedidos concluídos que respeitam o valor mínimo configurado contam para o progresso.",
                        },
                        {
                            title: "Progresso fica vinculado ao telefone",
                            description: "O número usado no pedido identifica o saldo de fidelidade daquele cliente no restaurante.",
                        },
                        {
                            title: "Meta é atingida",
                            description: "Quando o saldo chega à quantidade necessária, a recompensa configurada pode ser usada em um pedido.",
                        },
                        {
                            title: "Resgate consome a meta",
                            description: "Depois do uso, o progresso correspondente ao prêmio é descontado e o ciclo pode começar novamente.",
                        },
                    ]}
                />
            </BlogSection>

            <BlogSection id="recompensa" title="Como escolher uma recompensa que o cliente queira usar">
                <p>
                    O prêmio precisa equilibrar três coisas: desejo do cliente, custo para o
                    restaurante e simplicidade operacional. Dar o produto mais caro do
                    cardápio pode gerar interesse, mas também pode tornar o programa
                    insustentável.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
                        <p className="font-bold text-gray-950">Boas recompensas</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Item popular, custo controlado, fácil de produzir e com valor
                            percebido maior do que o custo real para o restaurante.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
                        <p className="font-bold text-gray-950">Recompensas frágeis</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Produto de margem apertada, preparo complexo, disponibilidade
                            irregular ou prêmio tão pequeno que não motiva recompra.
                        </p>
                    </div>
                </div>
                <BlogSubheading>Use um item do próprio cardápio</BlogSubheading>
                <p>
                    Isso deixa a operação previsível. No iMenu, o restaurante seleciona o
                    <strong> item principal gratuito</strong> e pode marcar quais
                    complementos daquele produto já fazem parte do prêmio. Assim, a
                    recompensa não depende de um texto solto que a equipe precisa interpretar.
                </p>
                <BlogCallout title="Calcule pelo custo, não pelo preço de venda" variant="tip">
                    Um item vendido por R$ 25 não custa necessariamente R$ 25 para você. Use
                    custo de ingredientes, embalagem e impacto operacional para decidir se a
                    recompensa cabe na estratégia.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="meta" title="Quantos pedidos colocar na meta de fidelidade">
                <p>
                    Não existe um número universal. Uma meta curta libera prêmios com mais
                    frequência; uma meta longa reduz o custo, mas pode parecer distante e
                    deixar de influenciar a decisão de compra.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Pergunta</th>
                                <th className="px-5 py-4 font-bold">Como usar na decisão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Qual é o ticket médio?</td><td className="px-5 py-4">Ajuda a estimar quanto de receita acontece antes de um resgate.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Qual é o custo do prêmio?</td><td className="px-5 py-4">Mostra o custo real do incentivo por ciclo concluído.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Com que frequência o cliente volta?</td><td className="px-5 py-4">Uma meta que leva muitos meses pode perder força psicológica.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Existe valor mínimo?</td><td className="px-5 py-4">Evita que pedidos muito pequenos contem igual a pedidos normais, se isso prejudicar a economia do programa.</td></tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Comece com uma regra fácil de explicar e ajuste com dados. Se quase
                    ninguém chega ao prêmio, a meta pode estar longa demais. Se o programa
                    gera muito resgate sem recompra adicional, o prêmio ou a regra podem estar
                    generosos demais.
                </p>
            </BlogSection>

            <BlogSection id="configurar" title="Como configurar programa de fidelidade no iMenu">
                <BlogChecklist
                    items={[
                        "Ative o programa no painel de Fidelidade",
                        "Defina a meta de pedidos ou selos",
                        "Escolha o valor mínimo para um pedido contar, se necessário",
                        "Selecione o item principal que será dado como recompensa",
                        "Marque os complementos que já vêm grátis no prêmio",
                        "Salve a configuração e faça um pedido de teste",
                        "Conclua o pedido de teste para conferir o crédito do selo",
                        "Valide o fluxo de resgate antes de divulgar aos clientes",
                    ]}
                />
                <p>
                    No fluxo atual do iMenu, o progresso é creditado quando um pedido elegível
                    é marcado como <strong>concluído</strong>. Se o pedido for cancelado depois
                    de ter gerado fidelidade, o sistema também trata a reversão do crédito.
                </p>
                <BlogCallout title="Teste o ciclo inteiro" variant="warning">
                    Não valide apenas a tela de configuração. Faça um pedido, conclua, confira
                    o progresso e simule o resgate. Programa de fidelidade só está pronto
                    quando o ciclo completo funciona.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="divulgar" title="Como divulgar fidelidade sem criar confusão">
                <p>
                    O programa precisa aparecer nos pontos em que o cliente já está pensando
                    em comprar novamente. A regra deve caber em uma frase curta.
                </p>
                <BlogChecklist
                    items={[
                        "Explique quantos pedidos liberam a recompensa",
                        "Mostre qual é o prêmio com nome claro",
                        "Informe valor mínimo quando existir",
                        "Use o mesmo número de telefone no pedido para manter o progresso",
                        "Divulgue no WhatsApp após pedidos concluídos, sem spam",
                        "Inclua a regra em embalagem, balcão ou material de recompra",
                    ]}
                />
                <p>
                    Um exemplo de comunicação simples é: <strong>“A cada pedido acima de R$
                    30 você ganha 1 selo. Complete 8 e resgate um X-Burger.”</strong> Se a regra
                    exige um parágrafo para ser entendida, simplifique antes de divulgar.
                </p>
            </BlogSection>

            <BlogSection id="erros" title="Erros comuns em programas de fidelidade de restaurante">
                <BlogSubheading>Prêmio que custa demais</BlogSubheading>
                <p>
                    A recompensa não deve consumir toda a margem criada pelos pedidos do
                    ciclo. Calcule o custo real e escolha algo desejável, mas sustentável.
                </p>
                <BlogSubheading>Meta impossível</BlogSubheading>
                <p>
                    Se o cliente precisa comprar tantas vezes que não acredita que vai chegar
                    ao prêmio, o programa deixa de influenciar comportamento.
                </p>
                <BlogSubheading>Regra mudando toda semana</BlogSubheading>
                <p>
                    Fidelidade depende de confiança. Alterações frequentes de meta, prêmio e
                    valor mínimo geram sensação de que o benefício nunca é estável.
                </p>
                <BlogSubheading>Equipe não conhece o programa</BlogSubheading>
                <p>
                    Atendimento, cozinha e caixa precisam saber qual é o prêmio e o que está
                    incluso. Se cada pessoa explica uma regra diferente, o incentivo vira
                    atrito.
                </p>
            </BlogSection>

            <BlogSection id="metricas" title="Métricas para saber se a fidelidade está funcionando">
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ["Clientes com progresso", "Quantas pessoas já acumularam pelo menos um pedido elegível."],
                        ["Taxa de conclusão", "Percentual dos participantes que realmente chegam à meta."],
                        ["Tempo até o prêmio", "Quanto tempo, em média, leva para um cliente completar o ciclo."],
                        ["Taxa de resgate", "Quantos clientes com saldo suficiente usam de fato a recompensa."],
                        ["Recompra", "Se participantes voltam com mais frequência do que antes do programa."],
                        ["Custo por prêmio", "Custo real da recompensa dividido pelos ciclos resgatados."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
            </BlogSection>
        </BlogArticle>
    );
}

import { faTags } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("promocoes-para-delivery")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "objetivo", label: "Comece pelo objetivo" },
    { id: "ideias", label: "8 ideias de promoção" },
    { id: "regras", label: "Regras que protegem margem" },
    { id: "automatizar", label: "Como automatizar" },
    { id: "cupom", label: "Promoção ou cupom" },
    { id: "margem", label: "Como não perder margem" },
    { id: "testar", label: "Como testar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Qual é a melhor promoção para delivery?",
        answer:
            "Depende do objetivo. Frete grátis pode reduzir uma barreira de compra, valor mínimo pode aumentar ticket, desconto por dia pode movimentar horários fracos e produto grátis pode aumentar valor percebido com custo controlado.",
    },
    {
        question: "Como fazer promoção no delivery sem ter prejuízo?",
        answer:
            "Defina primeiro o comportamento que deseja incentivar, calcule o custo máximo do benefício e use regras como valor mínimo, dias específicos ou compra de determinados produtos para controlar a margem.",
    },
    {
        question: "Promoção automática é a mesma coisa que cupom?",
        answer:
            "Não. A promoção automática é aplicada quando o pedido atende às regras configuradas. O cupom depende de um código. No iMenu, uma promoção pode permitir ou bloquear o acúmulo com cupom.",
    },
    {
        question: "O iMenu aplica promoção automaticamente?",
        answer:
            "Sim. O restaurante pode combinar regras de dia da semana, valor mínimo e compra de produto com benefícios de entrega grátis, desconto em porcentagem, desconto em reais ou produto grátis.",
    },
    {
        question: "Posso criar promoção para pedidos de mesa?",
        answer:
            "Sim. A promoção pode ser habilitada para Delivery, Mesa ou ambos. Benefícios que dependem de entrega, como frete grátis, naturalmente só têm efeito quando existe taxa de entrega.",
    },
];

export default function PromocoesParaDeliveryPage() {
    return (
        <BlogArticle
            article={article}
            icon={faTags}
            takeaways={[
                "8 formatos de promoção com objetivos diferentes",
                "Regras para usar desconto sem transformar margem em custo fixo",
                "Como automatizar frete grátis, descontos e brindes no iMenu",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "taxa-de-entrega-por-bairro",
                "como-aumentar-ticket-medio-restaurante",
                "como-criar-combo-no-delivery",
            ]}
            ctaTitle="Crie promoções com regras claras e aplique o benefício automaticamente"
        >
            <BlogSection
                id="objetivo"
                title="Promoção para delivery começa pelo objetivo, não pelo desconto"
            >
                <p>
                    Uma boa <strong>promoção para delivery</strong> não é simplesmente
                    baixar o preço. Ela deve incentivar um comportamento que melhora a
                    operação: aumentar o ticket médio, movimentar um dia fraco, vender
                    um item específico ou reduzir a barreira causada pela taxa de
                    entrega.
                </p>
                <p>
                    Quando o restaurante começa escolhendo “10% de desconto” antes de
                    definir o objetivo, corre o risco de dar benefício para pedidos que
                    aconteceriam de qualquer forma. O resultado pode ser mais vendas e
                    menos margem ao mesmo tempo.
                </p>
                <BlogCallout title="A pergunta certa" variant="tip">
                    Antes de criar a oferta, complete a frase: “Quero dar este benefício
                    somente quando o cliente fizer ______.” A resposta vira a regra da
                    promoção.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="ideias"
                title="8 ideias de promoções para delivery que têm uma regra clara"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ["1. Frete grátis com valor mínimo", "Ex.: entrega grátis em pedidos a partir de R$ 60. Ajuda a reduzir a barreira do frete sem subsidiar carrinhos muito pequenos."],
                        ["2. Desconto em dia fraco", "Ex.: 10% de desconto às terças. Use quando o objetivo é deslocar demanda para um período com menor volume."],
                        ["3. Desconto fixo acima de um valor", "Ex.: R$ 8 de desconto acima de R$ 70. O custo máximo do benefício fica previsível."],
                        ["4. Percentual acima de um valor mínimo", "Ex.: 10% a partir de R$ 50. A regra impede que pedidos muito pequenos recebam o incentivo."],
                        ["5. Compre e ganhe", "Ex.: comprando 2 hambúrgueres, ganhe 1 sobremesa. Funciona bem quando o brinde tem bom valor percebido e custo controlado."],
                        ["6. Produto grátis em dia específico", "Ex.: refrigerante grátis aos domingos em pedidos acima de R$ 80. Combina calendário, ticket e prêmio."],
                        ["7. Benefício para uma categoria estratégica", "Use uma regra de compra de produto para incentivar itens que puxam adicionais, bebidas ou sobremesas."],
                        ["8. Frete grátis em região cara, mas com condição", "Mantenha a taxa normal do bairro e remova o frete somente quando o pedido atingir o valor mínimo definido pela campanha."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
            </BlogSection>

            <BlogSection
                id="regras"
                title="As regras que transformam desconto em estratégia"
            >
                <p>
                    O benefício é o que chama atenção do cliente. A regra é o que
                    protege o restaurante. Em vez de liberar uma oferta para qualquer
                    pedido, use condições que aproximem a promoção do resultado que
                    você quer gerar.
                </p>
                <BlogChecklist
                    items={[
                        <><strong>Dia da semana:</strong> concentre a campanha em períodos que precisam de demanda.</>,
                        <><strong>Valor mínimo:</strong> use a promoção para empurrar o carrinho acima do ticket atual.</>,
                        <><strong>Compra de produto:</strong> vincule o benefício a um item e quantidade específicos.</>,
                        <><strong>Canal:</strong> escolha se a oferta vale para Delivery, Mesa ou ambos.</>,
                        <><strong>Visibilidade:</strong> decida se a promoção deve aparecer no cardápio antes de ser aplicada.</>,
                        <><strong>Cupom:</strong> defina se o benefício pode ou não acumular com um código promocional.</>,
                    ]}
                />
                <p>
                    Quando existem várias regras na mesma promoção, todas precisam ser
                    atendidas. Isso permite criar campanhas específicas, como
                    <strong> “entrega grátis aos domingos em pedidos a partir de R$ 60”</strong>
                    em vez de liberar o frete sem controle.
                </p>
            </BlogSection>

            <BlogSection
                id="automatizar"
                title="Como automatizar promoções no iMenu"
            >
                <p>
                    No iMenu, as promoções automáticas ficam em
                    <strong> Painel &gt; Promoções &gt; Promoções</strong>. O restaurante
                    cria as condições e escolhe o que o cliente ganha. Quando o pedido
                    atende às regras, o sistema calcula e aplica o benefício sem exigir
                    que o cliente digite um código.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Escolha onde a promoção vale",
                            description:
                                "Ative a campanha para Delivery, Mesa ou ambos.",
                        },
                        {
                            title: "Adicione as regras",
                            description:
                                "Use dias da semana, valor mínimo e/ou compra de produto. Todas as regras configuradas precisam ser cumpridas.",
                        },
                        {
                            title: "Escolha o benefício",
                            description:
                                "Entrega grátis, desconto em porcentagem, desconto em reais ou produto grátis.",
                        },
                        {
                            title: "Defina se aparece no cardápio",
                            description:
                                "A oferta pode ser divulgada durante a navegação para incentivar o cliente a cumprir a condição.",
                        },
                        {
                            title: "Teste um carrinho que cumpre e outro que não cumpre",
                            description:
                                "Valide valor mínimo, dia, produtos e total final antes de divulgar a campanha.",
                        },
                    ]}
                />
                <p>
                    Quando o benefício é um produto grátis e o item está disponível, o
                    iMenu pode adicioná-lo automaticamente ao carrinho. O carrinho e o
                    pedido também exibem o benefício aplicado para deixar o total
                    transparente.
                </p>
                <BlogCallout title="O sistema escolhe a melhor oferta elegível" variant="info">
                    Se mais de uma promoção automática estiver válida, o iMenu compara
                    o valor dos benefícios elegíveis e aplica a opção mais vantajosa
                    para aquele pedido, em vez de acumular várias promoções automáticas
                    sem controle.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="cupom"
                title="Promoção automática ou cupom: quando usar cada um"
            >
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Formato</th>
                                <th className="px-5 py-4 font-bold">Como ativa</th>
                                <th className="px-5 py-4 font-bold">Bom para</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Promoção automática</td>
                                <td className="px-5 py-4">O pedido cumpre as regras</td>
                                <td className="px-5 py-4">Frete grátis, dias específicos, metas de carrinho e brindes automáticos</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Cupom</td>
                                <td className="px-5 py-4">Cliente informa um código</td>
                                <td className="px-5 py-4">Campanhas com influenciadores, canais, públicos ou códigos divulgados</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    No iMenu, o restaurante decide se uma promoção automática permite
                    acumular cupom. Deixar o acúmulo desligado por padrão ajuda a evitar
                    combinações de desconto que não foram planejadas.
                </p>
            </BlogSection>

            <BlogSection
                id="margem"
                title="Como fazer promoção no delivery sem destruir a margem"
            >
                <BlogSubheading>Calcule o custo máximo do benefício</BlogSubheading>
                <p>
                    Em desconto fixo, o custo é fácil de enxergar. Em percentual, o
                    valor cresce junto com o carrinho. Em frete grátis, o custo depende
                    da região. Em produto grátis, use o custo do item para a operação,
                    não apenas o preço de venda.
                </p>
                <BlogSubheading>Troque benefício por comportamento</BlogSubheading>
                <p>
                    Se o objetivo é aumentar ticket, não dê entrega grátis em qualquer
                    compra. Coloque um valor mínimo. Se o objetivo é movimentar terça,
                    não mantenha o desconto sete dias por semana.
                </p>
                <BlogSubheading>Evite promoções permanentes sem motivo</BlogSubheading>
                <p>
                    Uma oferta que fica ativa o tempo todo tende a virar o novo preço
                    percebido pelo cliente. Use regras e períodos para que a campanha
                    continue tendo função comercial.
                </p>
                <BlogCallout title="Faturamento maior não garante lucro maior" variant="warning">
                    Compare ticket, margem e custo do benefício antes e depois da
                    campanha. Uma promoção só é boa quando o comportamento adicional
                    compensa o incentivo concedido.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="testar"
                title="Checklist antes de colocar a promoção no ar"
            >
                <BlogChecklist
                    items={[
                        "Confirme se a promoção está ativa",
                        "Valide se o canal correto está habilitado",
                        "Teste um dia válido e um dia inválido",
                        "Teste exatamente o valor mínimo e um centavo abaixo",
                        "Confirme a disponibilidade dos produtos usados como regra ou prêmio",
                        "Confira se cupom pode ou não acumular conforme planejado",
                        "Valide o total final do carrinho",
                        "Faça um pedido agendado se a campanha depende do dia da semana",
                    ]}
                />
                <p>
                    Em pedidos agendados de delivery, as condições de dia da semana
                    consideram a data agendada. Isso evita que uma promoção de domingo
                    seja aplicada a um pedido feito no domingo, mas marcado para outro
                    dia.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

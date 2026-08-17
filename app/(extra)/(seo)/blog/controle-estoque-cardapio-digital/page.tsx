import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("controle-estoque-cardapio-digital")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "por-que", label: "Por que controlar" },
    { id: "como-funciona", label: "Como funciona" },
    { id: "passo-a-passo", label: "Configuração" },
    { id: "quando-usar", label: "Quando usar" },
    { id: "operacao", label: "Rotina da equipe" },
    { id: "erros", label: "Erros comuns" },
    { id: "metricas", label: "O que acompanhar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como funciona controle de estoque em cardápio digital?",
        answer:
            "O restaurante define a quantidade disponível de um produto. A cada pedido confirmado pelo sistema, essa quantidade pode ser reduzida e, quando chega a zero, o item deixa de ficar disponível para novos pedidos.",
    },
    {
        question: "Preciso controlar estoque de todos os produtos?",
        answer:
            "Não. O mais útil é ativar o controle apenas nos itens cuja quantidade realmente limita as vendas, como sobremesas produzidas em lote, kits, produtos sazonais ou itens com poucas unidades.",
    },
    {
        question: "O iMenu impede pedido acima do estoque disponível?",
        answer:
            "Sim. Quando o controle está ativo, o pedido valida a quantidade disponível antes de ser criado e bloqueia uma quantidade maior do que o saldo do produto.",
    },
    {
        question: "O que acontece quando o estoque chega a zero no iMenu?",
        answer:
            "Ao chegar a zero, o produto é marcado como indisponível. Se a quantidade for atualizada novamente, o restaurante pode voltar a disponibilizá-lo conforme a operação.",
    },
];

export default function ControleEstoqueCardapioDigitalPage() {
    return (
        <BlogArticle
            article={article}
            icon={faBoxesStacked}
            takeaways={[
                "Uma forma simples de evitar pedidos de produtos que já acabaram",
                "Critérios para decidir quais itens realmente precisam de estoque contado",
                "Uma rotina curta para manter quantidade e disponibilidade alinhadas",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-montar-cardapio-delivery",
                "criar-cardapio-com-ia",
                "como-vender-delivery-pelo-whatsapp",
            ]}
            ctaTitle="Mantenha o cardápio alinhado ao que realmente pode ser vendido"
        >
            <BlogSection id="por-que" title="Estoque no cardápio digital evita vender o que já acabou">
                <p>
                    Um dos atritos mais frustrantes no delivery acontece depois que o cliente
                    já escolheu: ele monta o pedido, envia e só então recebe a mensagem de que
                    um item acabou. A equipe precisa oferecer troca, recalcular o total e
                    prolongar uma compra que deveria ser simples.
                </p>
                <p>
                    O <strong>controle de estoque no cardápio digital</strong> reduz esse
                    problema ao conectar a quantidade disponível à possibilidade de vender.
                    Quando o saldo termina, o item pode sair de disponibilidade antes que o
                    próximo cliente tente comprá-lo.
                </p>
                <BlogCallout title="Estoque de cardápio não precisa substituir seu estoque completo" variant="info">
                    O objetivo aqui é controlar disponibilidade de venda por produto. Você
                    não precisa transformar o cardápio em um ERP de ingredientes para obter
                    valor dessa função.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-funciona" title="Como o controle de estoque do iMenu funciona">
                <BlogSteps
                    items={[
                        {
                            title: "Você ativa o estoque no produto",
                            description: "O controle é opcional e pode ser ligado apenas nos itens em que a quantidade importa.",
                        },
                        {
                            title: "Define a quantidade disponível",
                            description: "Informe quantas unidades daquele produto podem ser vendidas naquele momento.",
                        },
                        {
                            title: "Pedido valida o saldo",
                            description: "Antes de criar o pedido, o sistema verifica se existe quantidade suficiente para cada item com estoque ativo.",
                        },
                        {
                            title: "Quantidade é descontada",
                            description: "Quando o pedido é criado, as unidades vendidas são abatidas do saldo do produto dentro da mesma operação.",
                        },
                        {
                            title: "Zero fica indisponível",
                            description: "Se o saldo chega a zero, o item é marcado como indisponível para evitar uma nova venda sem estoque.",
                        },
                        {
                            title: "Falha de pagamento pode restaurar saldo",
                            description: "Em pedidos Pix online que falham antes da confirmação, o sistema possui tratamento para restaurar as unidades reservadas.",
                        },
                    ]}
                />
                <BlogCallout title="A validação acontece no pedido" variant="tip">
                    Isso é importante porque dois clientes podem tentar comprar o último item
                    quase ao mesmo tempo. O sistema verifica a quantidade antes de concluir a
                    criação do pedido, não apenas quando a página do cardápio foi carregada.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="passo-a-passo" title="Como configurar estoque no cardápio">
                <BlogChecklist
                    items={[
                        "Abra Cardápio e entre na aba Estoque",
                        "Localize o produto pela categoria",
                        "Ative o controle de estoque naquele item",
                        "Informe uma quantidade inteira igual às unidades disponíveis",
                        "Faça um pedido de teste com uma unidade",
                        "Confirme se o saldo diminuiu depois do pedido",
                        "Teste também a última unidade para validar a indisponibilidade",
                        "Defina quem da equipe será responsável por repor a quantidade",
                    ]}
                />
                <p>
                    No painel do iMenu, a quantidade pode ser atualizada diretamente na lista
                    de produtos. A alteração é salva enquanto a equipe trabalha, sem exigir
                    abrir a edição completa de cada item.
                </p>
            </BlogSection>

            <BlogSection id="quando-usar" title="Quais produtos vale a pena controlar por quantidade">
                <p>
                    Contar tudo pode criar trabalho desnecessário. Comece onde o risco de
                    vender algo esgotado é maior ou onde a quantidade disponível é fácil de
                    medir.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ["Sobremesas em lote", "Brownies, fatias, pudins e doces produzidos em uma quantidade fechada para o dia."],
                        ["Combos limitados", "Kits promocionais ou combos que dependem de um lote específico."],
                        ["Produtos sazonais", "Itens especiais de fim de semana, feriados ou campanhas com quantidade reduzida."],
                        ["Bebidas específicas", "Garrafas, latas ou sabores com poucas unidades e reposição não imediata."],
                        ["Itens de produção longa", "Produtos que não podem ser repostos rapidamente durante o horário de pico."],
                        ["Mercadoria pronta", "Operações que revendem produtos unitários e conhecem exatamente o saldo disponível."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
                <BlogSubheading>Quando não contar unidade por unidade</BlogSubheading>
                <p>
                    Se um produto é preparado sob demanda e seus ingredientes são
                    compartilhados com dezenas de outros itens, controlar “37 hambúrgueres”
                    pode não representar o estoque real. Nesse caso, disponibilidade manual
                    ou um controle de ingredientes separado pode fazer mais sentido.
                </p>
            </BlogSection>

            <BlogSection id="operacao" title="Uma rotina de estoque que a equipe consegue manter">
                <p>
                    A função só ajuda se alguém atualizar reposições e correções. A melhor
                    rotina é curta o suficiente para caber no início e no fim do turno.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Abertura",
                            description: "Confira os produtos controlados e ajuste a quantidade inicial com base no que realmente está disponível.",
                        },
                        {
                            title: "Durante o turno",
                            description: "Pedidos reduzem o saldo. Se houver perda, consumo interno ou produção extra, corrija a quantidade no painel.",
                        },
                        {
                            title: "Reposição",
                            description: "Quando um novo lote ficar pronto, aumente o saldo antes de anunciar o item novamente.",
                        },
                        {
                            title: "Fechamento",
                            description: "Compare o saldo do sistema com as unidades restantes e investigue diferenças recorrentes.",
                        },
                    ]}
                />
                <BlogCallout title="Escolha um responsável por turno" variant="tip">
                    Se todo mundo pode corrigir estoque, mas ninguém é responsável por isso,
                    as quantidades tendem a ficar desatualizadas justamente no horário de pico.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="erros" title="Erros comuns no controle de estoque do delivery">
                <BlogSubheading>Ativar estoque e nunca atualizar reposição</BlogSubheading>
                <p>
                    O item chega a zero, fica indisponível e continua assim mesmo depois de
                    um novo lote ficar pronto. Defina a reposição como parte da rotina de
                    produção.
                </p>
                <BlogSubheading>Contar produto que não tem unidade clara</BlogSubheading>
                <p>
                    Se a quantidade é apenas uma estimativa sem relação com a capacidade real
                    de produção, o número cria falsa precisão e aumenta manutenção.
                </p>
                <BlogSubheading>Corrigir indisponibilidade apenas no WhatsApp</BlogSubheading>
                <p>
                    Avisar um cliente por mensagem não impede o próximo de pedir. A fonte de
                    verdade precisa ser o cardápio usado para montar o pedido.
                </p>
                <BlogSubheading>Ignorar estoque em promoções</BlogSubheading>
                <p>
                    Uma campanha pode acelerar vendas e zerar um lote muito antes do normal.
                    Antes de divulgar, confirme se os itens promocionais estão com quantidade
                    compatível com o volume esperado.
                </p>
            </BlogSection>

            <BlogSection id="metricas" title="O que acompanhar depois de ativar o estoque">
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Sinal</th>
                                <th className="px-5 py-4 font-bold">O que pode indicar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Itens zerando cedo</td><td className="px-5 py-4">Produção inicial baixa para a demanda ou promoção mais forte do que o previsto.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Muitas correções manuais</td><td className="px-5 py-4">Perdas, consumo interno ou processo de contagem pouco claro.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Saldo sobrando todo dia</td><td className="px-5 py-4">O item pode ter produção acima da demanda ou previsão inicial superestimada.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Clientes perguntando por item esgotado</td><td className="px-5 py-4">Disponibilidade ainda está sendo comunicada fora do cardápio ou atualizada tarde demais.</td></tr>
                        </tbody>
                    </table>
                </div>
            </BlogSection>
        </BlogArticle>
    );
}

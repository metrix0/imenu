import Link from "next/link";
import { faCashRegister } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("como-fazer-fechamento-de-caixa-restaurante")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é o fechamento de caixa" },
    { id: "como-fazer", label: "Como fechar o caixa diariamente" },
    { id: "conferir", label: "Conferência por pagamento" },
    { id: "imenu", label: "Fechamento de Caixa no iMenu" },
    { id: "erros-comuns", label: "Erros para evitar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como fazer fechamento de caixa de restaurante?",
        answer: "Escolha o dia, reúna os pedidos pagos ou concluídos, separe os valores por forma de pagamento e confira cada um com dinheiro, comprovantes e registros da maquininha. Anote e investigue diferenças antes de encerrar o dia.",
    },
    {
        question: "O iMenu tem fechamento de caixa?",
        answer: "Sim. Em Histórico, o restaurante encontra Fechamento de Caixa, com total de vendas, quantidade de pedidos para entrega e retirada, pedidos no salão e valores por Pix, cartão e dinheiro. É possível selecionar hoje, ontem ou uma data específica.",
    },
    {
        question: "Pedidos cancelados ou ainda não pagos entram no fechamento?",
        answer: "O resumo considera pedidos pagos ou concluídos conforme o status e a forma de pagamento. Pedidos cancelados e pedidos sem confirmação de pagamento não devem ser tratados como vendas recebidas.",
    },
    {
        question: "O total de vendas é igual ao dinheiro na gaveta?",
        answer: "Não necessariamente. O total reúne diferentes formas de pagamento; Pix e cartão não ficam no caixa físico. Além disso, a conferência de espécie, maquininha e repasses precisa ser feita separadamente.",
    },
    {
        question: "Consigo consultar o fechamento de uma data anterior?",
        answer: "Sim. Na área Fechamento de Caixa do Histórico do iMenu, use Hoje, Ontem ou o seletor Data para abrir o resumo de outro dia.",
    },
];

export default function ComoFazerFechamentoDeCaixaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faCashRegister}
            takeaways={[
                "Como organizar uma rotina de fechamento diário sem misturar meios de pagamento",
                "O que conferir em Pix, cartão e dinheiro",
                "Como consultar o resumo de vendas no Histórico do iMenu",
                "Quais diferenças precisam de conferência fora do sistema",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "controle-estoque-cardapio-digital",
                "como-aumentar-ticket-medio-restaurante",
                "analise-de-vendas-com-ia",
            ]}
            ctaTitle="Organize seus pedidos e consulte o fechamento diário no iMenu"
        >
            <BlogSection id="o-que-e" title="Fechamento de caixa: saiba quanto vendeu e como recebeu">
                <p>
                    No fim do expediente, não basta olhar quanto entrou em pedidos.
                    O fechamento de caixa serve para <strong>conferir as vendas registradas
                    e separar as formas de pagamento</strong>, identificando diferenças
                    que precisam ser investigadas antes do próximo turno.
                </p>
                <p>
                    Imagine R$ 800 em vendas: parte foi paga em dinheiro, parte por
                    Pix e parte no cartão. Esse total não significa que existam
                    R$ 800 na gaveta. Uma conferência organizada evita confundir
                    faturamento, dinheiro físico e valores que ainda serão repassados.
                </p>
                <BlogCallout title="Fechamento não é cálculo de lucro" variant="tip">
                    O total vendido é um ponto de partida. Custos de ingredientes,
                    embalagens, taxas e outras despesas precisam ser analisados
                    separadamente para descobrir o resultado do restaurante.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-fazer" title="Como fazer o fechamento de caixa do restaurante, passo a passo">
                <p>
                    Escolha um horário de corte que sua equipe consiga repetir.
                    Se você recebe pedidos até tarde, deixe claro a qual dia
                    cada venda pertence e use o mesmo critério na conferência.
                </p>
                <BlogSteps items={[
                    {
                        title: "Separe os pedidos do dia",
                        description: "Confira os pedidos pagos ou concluídos e evite incluir cancelados ou cobranças ainda pendentes como valores recebidos.",
                    },
                    {
                        title: "Agrupe as vendas por forma de pagamento",
                        description: "Liste Pix, cartão e dinheiro. Essa separação mostra onde conferir um valor quando surgir uma diferença.",
                    },
                    {
                        title: "Confira os registros externos",
                        description: "Compare o dinheiro contado com as vendas em espécie e confira Pix e cartão nos extratos, comprovantes ou relatórios correspondentes.",
                    },
                    {
                        title: "Registre e investigue diferenças",
                        description: "Anote divergências, pedidos com pagamento não informado e eventuais ajustes necessários. Não altere valores para forçar a igualdade.",
                    },
                    {
                        title: "Guarde o resultado do dia",
                        description: "Registre a data da conferência, os totais por meio de pagamento e quem fez a checagem para facilitar uma revisão posterior.",
                    },
                ]} />
                <BlogSubheading>Exemplo simples de conferência</BlogSubheading>
                <p>
                    Suponha que o relatório mostre R$ 200 em dinheiro, R$ 350 em Pix
                    e R$ 250 em cartão: o total de vendas é R$ 800.
                    A conferência do caixa físico começa pelos R$ 200, descontando
                    ou justificando retiradas e troco conforme os controles da loja.
                    Pix e cartão devem ser comparados com seus respectivos registros.
                </p>
            </BlogSection>

            <BlogSection id="conferir" title="Por que conferir Pix, cartão e dinheiro separadamente">
                <p>
                    Cada forma de pagamento deixa um registro diferente.
                    Somar tudo em um único número ajuda a entender as vendas,
                    mas não é suficiente para descobrir a origem de uma divergência.
                </p>
                <BlogChecklist items={[
                    <span key="pix"><strong>Pix:</strong> confira se o pagamento foi confirmado e qual conta ou intermediador recebeu o valor. Não confunda venda confirmada com repasse já depositado.</span>,
                    <span key="cartao"><strong>Cartão:</strong> confira as operações da maquininha e seus comprovantes, considerando que o crédito pode ter prazo de recebimento diferente do dia da venda.</span>,
                    <span key="dinheiro"><strong>Dinheiro:</strong> conte o caixa físico e registre troco inicial, retiradas e outras movimentações fora dos pedidos.</span>,
                    <span key="sem-metodo"><strong>Não informado:</strong> investigue pedidos sem forma de pagamento identificada antes de assumir em qual grupo eles entram.</span>,
                ]} />
                <BlogCallout title="Não confunda vendas do dia com repasses" variant="info">
                    O fechamento organiza vendas registradas. Para acompanhar
                    valores a receber de pagamentos processados pelo iMenu,
                    consulte também a área <Link href="/painel/repasses" className="font-semibold text-brand underline">Repasses</Link>.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="imenu" title="Como ver o Fechamento de Caixa no iMenu">
                <p>
                    O <Link href="/painel/historico" className="font-semibold text-brand underline">Histórico de pedidos do iMenu</Link>
                    {" "}inclui uma seção chamada <strong>Fechamento de Caixa</strong>.
                    Nela, o restaurante consulta um resumo de um dia específico
                    sem precisar somar manualmente cada pedido.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra Histórico no painel",
                        description: <>Acesse <Link href="/painel/historico" className="font-semibold text-brand underline">Histórico</Link> e encontre a seção Fechamento de Caixa.</>,
                    },
                    {
                        title: "Selecione a data",
                        description: "Use Hoje, Ontem ou o seletor Data para consultar outro dia.",
                    },
                    {
                        title: "Leia os indicadores",
                        description: "Confira total de vendas, pedidos para entrega e retirada, pedidos no salão e a separação de valores por Pix, cartão e dinheiro.",
                    },
                    {
                        title: "Compare com a operação",
                        description: "Use o resumo como referência para conferir o caixa físico, os comprovantes e os registros financeiros externos.",
                    },
                ]} />
                <BlogSubheading>O que entra nos números?</BlogSubheading>
                <p>
                    O resumo considera pedidos com pagamento online registrado
                    ou pedidos marcados como concluídos, conforme a forma de
                    pagamento. Não é um relatório de lucro, de taxas ou de saldo
                    disponível na conta. O resultado também depende dos
                    pagamentos e estados dos pedidos registrados corretamente.
                </p>
                <p>
                    Se sua loja opera delivery, retirada e mesas, o resumo também
                    informa a quantidade de pedidos dessas modalidades consideradas
                    no dia. Assim fica mais fácil entender de onde veio o movimento.
                </p>
            </BlogSection>

            <BlogSection id="erros-comuns" title="Erros comuns que fazem o fechamento não bater">
                <BlogChecklist items={[
                    <span key="pendente"><strong>Contar pedidos pendentes como pagos:</strong> um pedido criado não significa necessariamente dinheiro recebido.</span>,
                    <span key="troco"><strong>Esquecer o troco inicial:</strong> a gaveta pode ter dinheiro que já estava lá antes das vendas.</span>,
                    <span key="canais"><strong>Misturar os meios de pagamento:</strong> Pix e cartão não devem ser contados como espécie.</span>,
                    <span key="repasses"><strong>Tratar repasse como venda nova:</strong> receber hoje um valor de uma venda anterior não significa que houve outra venda.</span>,
                    <span key="data"><strong>Usar períodos diferentes:</strong> o extrato de uma conta e o resumo dos pedidos podem considerar horários de corte distintos.</span>,
                ]} />
                <p>
                    Comece pela diferença mais fácil de identificar: compare
                    a forma de pagamento, a data e os pedidos concluídos.
                    Uma rotina diária consistente vale mais do que tentar
                    reconstruir vários dias de movimento de uma vez.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

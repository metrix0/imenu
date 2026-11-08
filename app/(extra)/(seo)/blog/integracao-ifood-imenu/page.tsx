import Link from "next/link";
import { faLink } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("integracao-ifood-imenu")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "Como funciona" },
    { id: "requisitos", label: "Requisitos" },
    { id: "configuracao", label: "Como configurar" },
    { id: "pedidos", label: "Pedidos e impressão" },
    { id: "limites", label: "Limites da integração" },
    { id: "conferencia", label: "Checklist operacional" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "O iMenu recebe pedidos do iFood automaticamente?",
        answer: "Sim, quando a integração está operacional e autorizada. É necessário homologar a aplicação, autorizar a loja e configurar o recebimento de eventos do iFood. Salvar credenciais não significa que a conexão foi concluída.",
    },
    {
        question: "O iMenu imprime pedidos recebidos pelo iFood?",
        answer: "Os pedidos importados entram no fluxo de impressão do iMenu. Para a impressão automática ocorrer, o iMenu Impressora precisa estar configurado e com essa opção habilitada.",
    },
    {
        question: "Posso aceitar e atualizar pedidos do iFood pelo iMenu?",
        answer: "Sim, para as etapas contempladas e com as permissões autorizadas. O iMenu aguarda os eventos de confirmação do iFood para sincronizar os status.",
    },
    {
        question: "A integração envia os produtos e preços do meu cardápio ao iFood?",
        answer: "Não. A integração recebe pedidos e sincroniza etapas operacionais. Ela não publica produtos, preços ou estoque no iFood nem realiza cancelamentos ou reembolsos por lá.",
    },
    {
        question: "Preciso de uma aplicação homologada no iFood?",
        answer: "Sim. O ID da loja isolado não basta: a aplicação precisa estar homologada, ter credenciais autorizadas e possuir permissão de acesso aos pedidos e eventos da loja.",
    },
];

export default function IntegracaoIfoodImenuPage() {
    return (
        <BlogArticle
            article={article}
            icon={faLink}
            takeaways={[
                "Como pedidos do iFood aparecem nos painéis do iMenu",
                "Quais permissões e credenciais são necessárias antes da conexão",
                "Como aceitar pedidos, acompanhar o preparo e imprimir comandas",
                "O que continua sendo feito no próprio iFood",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "alternativa-ao-ifood",
                "como-montar-cardapio-delivery",
                "como-fazer-fechamento-de-caixa-restaurante",
            ]}
            ctaTitle="Organize os pedidos do seu restaurante com o iMenu"
        >
            <BlogSection id="o-que-e" title="O que é a integração iFood com iMenu?">
                <p>
                    O restaurante que vende por canais diferentes precisa
                    acompanhar cada novo pedido sem perder informações de preparo.
                    A <strong>integração iFood com iMenu</strong> traz pedidos
                    recebidos no iFood para os painéis de pedidos do iMenu, com
                    itens, quantidades, observações, valores e identificação da origem.
                </p>
                <p>
                    Quando a conexão está operacional, a equipe pode aceitar
                    pedidos e avançar as etapas de preparo pelo iMenu.
                    Os pedidos também entram no fluxo de impressão do sistema.
                    Isso ajuda a concentrar a operação, mas <strong>não substitui
                    a gestão comercial, o pagamento nem a logística do iFood</strong>.
                </p>
                <BlogCallout title="Conectar exige autorização do iFood" variant="info">
                    O recebimento dos pedidos depende de uma aplicação homologada,
                    da autorização da loja e da configuração dos eventos.
                    Não basta informar o ID da loja para a conexão funcionar.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="requisitos" title="Requisitos para conectar o iFood ao iMenu">
                <p>
                    Antes de ativar a integração, confirme se as permissões já
                    foram liberadas pelo parceiro. Isso evita configurar um
                    painel que ainda não pode receber novos pedidos.
                </p>
                <BlogChecklist items={[
                    <span key="app"><strong>Aplicação homologada:</strong> a integração utiliza uma aplicação aprovada no Portal de Parceiros do iFood.</span>,
                    <span key="acesso"><strong>Loja autorizada:</strong> o restaurante precisa ter acesso concedido à aplicação, inclusive para os pedidos e eventos necessários.</span>,
                    <span key="dados"><strong>Credenciais corretas:</strong> confirme o ID da loja, o Client ID e o Client Secret autorizados para essa aplicação.</span>,
                    <span key="eventos"><strong>Webhook aprovado:</strong> os eventos de novos pedidos e mudanças de estado precisam chegar à integração do iMenu.</span>,
                    <span key="impressao"><strong>Impressora opcional:</strong> para imprimir automaticamente, configure o iMenu Impressora e ative a função correspondente.</span>,
                ]} />
                <p>
                    Se ainda não recebeu as credenciais ou não sabe se sua loja
                    está liberada, procure o suporte antes de ativar. Não envie
                    chaves secretas pelo WhatsApp ou por mensagens públicas.
                </p>
            </BlogSection>

            <BlogSection id="configuracao" title="Como configurar a integração com iFood, passo a passo">
                <p>
                    No iMenu, entre em{" "}
                    <Link href="/painel/integracoes" className="font-semibold text-brand underline">
                        Integrações
                    </Link>{" "}e encontre a seção <strong>Delivery e Parceiros</strong>.
                    O iFood possui campos e ativação próprios, separados das
                    outras integrações do restaurante.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra o cartão iFood",
                        description: "Em Integrações, expanda o cartão iFood dentro de Delivery e Parceiros.",
                    },
                    {
                        title: "Preencha os dados autorizados",
                        description: "Informe o ID da loja no iFood, o Client ID e o Client Secret fornecidos pelo fluxo de homologação.",
                    },
                    {
                        title: "Ative e confira a configuração",
                        description: "Use o controle de ativação. Salvar os campos não valida por si só o acesso ao iFood; a aplicação e os eventos precisam estar liberados.",
                    },
                    {
                        title: "Valide a chegada de pedidos",
                        description: "Confirme que um novo pedido autorizado aparece no painel com itens e valores corretos antes de depender da integração durante o atendimento.",
                    },
                ]} />
                <BlogCallout title="O que significa “Não configurado”?" variant="tip">
                    O aviso indica campos obrigatórios incompletos. Mesmo quando
                    desaparece, ainda é necessário confirmar a homologação e
                    o recebimento real dos eventos da loja.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="pedidos" title="Recebimento, atualização e impressão de pedidos do iFood">
                <p>
                    Quando um novo pedido é recebido, o iMenu preserva os
                    detalhes importados e a identificação de que a origem
                    é o iFood. Isso evita confundi-lo com uma venda criada
                    pelo link próprio do restaurante.
                </p>
                <BlogSubheading>Aceite e preparo no painel</BlogSubheading>
                <p>
                    Conforme as permissões e a modalidade do pedido, a equipe
                    pode aceitar e atualizar etapas como início do preparo
                    e pronto para retirada. Os status só avançam após os
                    eventos correspondentes do iFood: enviar a solicitação
                    não é o mesmo que receber sua confirmação.
                    As etapas de entrega seguem as condições do parceiro.
                </p>
                <BlogSubheading>Como funciona a impressão automática</BlogSubheading>
                <p>
                    Os pedidos importados entram no fluxo de impressão
                    do iMenu. Para imprimir a comanda automaticamente,
                    mantenha o{" "}
                    <Link href="/painel/impressora" className="font-semibold text-brand underline">
                        iMenu Impressora
                    </Link>{" "}configurado e aberto no computador responsável,
                    com a impressão automática ativada. Conectar o iFood não
                    instala nem configura a impressora sozinho.
                </p>
            </BlogSection>

            <BlogSection id="limites" title="O que a integração iFood não sincroniza">
                <p>
                    A integração atual é voltada a <strong>pedidos e estados
                    operacionais</strong>. Algumas funções continuam sendo
                    administradas diretamente no iFood.
                </p>
                <BlogChecklist items={[
                    <span key="catalogo"><strong>Produtos e preços:</strong> alterações no cardápio do iMenu não são publicadas automaticamente no iFood.</span>,
                    <span key="estoque"><strong>Estoque:</strong> a integração não sincroniza quantidades de estoque entre os dois sistemas.</span>,
                    <span key="cancelamento"><strong>Cancelamento e reembolso:</strong> devem seguir o fluxo do iFood; o iMenu não envia esses comandos por essa integração.</span>,
                    <span key="logistica"><strong>Entregas:</strong> receber um pedido não significa solicitar um entregador nem transferir a logística para o iMenu.</span>,
                    <span key="whatsapp"><strong>WhatsApp:</strong> notificações automáticas de status do iMenu não são disparadas para os pedidos importados do iFood.</span>,
                ]} />
                <p>
                    Mantenha separadas as formas de pagamento e os repasses
                    de cada canal. Um pedido do iFood não deve ser
                    contabilizado como pagamento Pix Online processado
                    diretamente pelo iMenu.
                </p>
            </BlogSection>

            <BlogSection id="conferencia" title="Checklist antes de usar a integração no horário de pico">
                <p>
                    Antes de depender da integração durante o movimento,
                    verifique se a loja, o painel e a impressora estão
                    preparados para operar juntos.
                </p>
                <BlogSteps items={[
                    { title: "Confirme as permissões", description: "Verifique a homologação da aplicação, o acesso à loja e a configuração do webhook com o responsável pela integração." },
                    { title: "Confira a chegada de um pedido", description: "Valide a origem iFood, os itens, as observações e os valores apresentados no painel." },
                    { title: "Teste os estados", description: "Confirme a aceitação e o início do preparo, observando os eventos retornados pelo iFood." },
                    { title: "Confira a impressora", description: "Se usa impressão automática, valide o funcionamento da fila e a saída da comanda." },
                    { title: "Mantenha um plano alternativo", description: "Se a conexão não funcionar, acompanhe os pedidos diretamente no iFood enquanto a integração é verificada." },
                ]} />
                <p>
                    Se você também recebe pedidos por link próprio,
                    veja{" "}
                    <Link href="/blog/alternativa-ao-ifood" className="font-semibold text-brand underline">
                        como combinar seu canal próprio e o iFood
                    </Link>.
                    Os dois canais podem coexistir, mantendo claras as
                    responsabilidades de pagamento e entrega de cada um.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faComments } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("pedido-whatsapp-celular-confirmacao")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "problema", label: "Por que o WhatsApp pode não abrir" },
    { id: "como-funciona", label: "Como o iMenu resolve" },
    { id: "quando-funciona", label: "Quando esse fluxo é usado" },
    { id: "configuracao", label: "Configuração" },
    { id: "teste", label: "Como testar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Por que o WhatsApp pode não abrir depois que o cliente finaliza o pedido?",
        answer:
            "Navegadores móveis podem bloquear uma nova aba quando ela é aberta somente depois de uma operação assíncrona, como esperar a criação do pedido. O iMenu prepara a abertura do WhatsApp durante a ação do cliente e só conclui o redirecionamento depois que o pedido foi criado com sucesso.",
    },
    {
        question: "Essa confirmação pelo WhatsApp funciona com Pix Online?",
        answer:
            "Não nesse fluxo. Quando a forma de pagamento é Pix, o iMenu preserva o redirecionamento para o pagamento. A abertura auxiliar do WhatsApp é usada nos outros meios de pagamento quando a confirmação forçada está ativada.",
    },
    {
        question: "O WhatsApp abre antes de o pedido ser criado?",
        answer:
            "O navegador pode abrir uma tela intermediária de 'Abrindo WhatsApp...' imediatamente, mas o endereço final do WhatsApp só é enviado para essa tela depois que o pedido é criado e a confirmação está disponível.",
    },
    {
        question: "O que acontece se a criação do pedido falhar?",
        answer:
            "A tela auxiliar do WhatsApp é fechada. Assim, o cliente não é encaminhado para uma confirmação de um pedido que não foi criado.",
    },
];

export default function PedidoWhatsappCelularConfirmacaoPage() {
    return (
        <BlogArticle
            article={article}
            icon={faComments}
            takeaways={[
                "Por que navegadores móveis podem bloquear a abertura do WhatsApp",
                "Como o iMenu mantém a confirmação ligada ao pedido realmente criado",
                "Quais condições precisam estar ativas para esse fluxo funcionar",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-vender-delivery-pelo-whatsapp",
                "robo-whatsapp-para-restaurante",
                "como-montar-cardapio-delivery",
            ]}
            ctaTitle="Organize seus pedidos e use o WhatsApp sem depender de um fluxo frágil"
        >
            <BlogSection
                id="problema"
                title="Por que o WhatsApp pode não abrir depois de um pedido no celular"
            >
                <p>
                    Em muitos cardápios digitais, o cliente toca em <strong>finalizar</strong>,
                    o sistema cria o pedido e só depois tenta abrir o WhatsApp. No computador
                    isso pode passar despercebido, mas no celular existe um detalhe importante:
                    o navegador pode interpretar essa abertura tardia como um pop-up não iniciado
                    diretamente pelo usuário e bloqueá-la.
                </p>
                <p>
                    O resultado é confuso. O pedido pode ter sido criado corretamente, mas o
                    cliente espera que o WhatsApp abra para concluir a confirmação e nada acontece.
                    Para quem vende por delivery, isso parece uma falha no pedido mesmo quando o
                    problema está apenas na passagem entre o navegador e o WhatsApp.
                </p>
                <BlogCallout title="O ponto principal" variant="tip">
                    Criar o pedido e abrir o WhatsApp são duas etapas diferentes. Um fluxo confiável
                    precisa garantir que a segunda etapa não aconteça antes de a primeira dar certo.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="como-funciona"
                title="Como o iMenu torna a confirmação pelo WhatsApp mais confiável"
            >
                <p>
                    Quando a configuração de confirmação forçada está ativa, o iMenu prepara a
                    abertura do WhatsApp no momento em que o cliente finaliza o pedido no celular.
                    Em vez de tentar criar uma nova aba somente depois de esperar o servidor, ele
                    abre uma tela intermediária de <strong>“Abrindo WhatsApp...”</strong> ligada à
                    ação do próprio cliente.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Cliente toca para finalizar",
                            description:
                                "O iMenu abre a tela intermediária enquanto mantém o checkout em andamento.",
                        },
                        {
                            title: "O pedido é criado",
                            description:
                                "Itens, endereço, entrega e pagamento continuam sendo enviados normalmente para o iMenu.",
                        },
                        {
                            title: "A confirmação é preparada",
                            description:
                                "Depois do pedido existir, o iMenu busca o link de confirmação correspondente àquele pedido.",
                        },
                        {
                            title: "A tela segue para o WhatsApp",
                            description:
                                "Com a confirmação disponível, a janela que já estava aberta recebe o endereço final e encaminha o cliente ao WhatsApp.",
                        },
                    ]}
                />
                <p>
                    Essa ordem reduz a chance de o navegador bloquear a abertura e evita tratar o
                    WhatsApp como prova de que o pedido existe. O pedido continua sendo criado e
                    validado primeiro; o redirecionamento vem depois.
                </p>
            </BlogSection>

            <BlogSection
                id="quando-funciona"
                title="Quando esse fluxo de confirmação é usado"
            >
                <BlogChecklist
                    items={[
                        "O restaurante ativou “Forçar envio de Notificação no WhatsApp”",
                        "O cliente está finalizando pelo celular",
                        "A forma de pagamento escolhida não é Pix",
                        "O pedido foi criado com sucesso antes do redirecionamento final",
                    ]}
                />
                <BlogSubheading>Por que o Pix fica de fora?</BlogSubheading>
                <p>
                    No Pix, o checkout precisa preservar o caminho do pagamento online. Por isso,
                    esse redirecionamento auxiliar para o WhatsApp não é usado quando a forma de
                    pagamento selecionada é Pix.
                </p>
                <BlogSubheading>E se alguma etapa falhar?</BlogSubheading>
                <p>
                    Se a criação do pedido falhar, se a confirmação não estiver disponível ou se
                    ocorrer um erro ao buscar o link, o iMenu fecha a tela auxiliar. Isso evita
                    mandar o cliente ao WhatsApp com a impressão de que um pedido inexistente foi
                    confirmado.
                </p>
            </BlogSection>

            <BlogSection
                id="configuracao"
                title="Como ativar a confirmação forçada pelo WhatsApp"
            >
                <p>
                    No painel do restaurante, a opção usada por esse fluxo se chama
                    <strong> “Forçar envio de Notificação no WhatsApp”</strong>. Ela deve ser usada
                    quando o restaurante realmente precisa que o cliente passe pelo WhatsApp após
                    finalizar pedidos compatíveis.
                </p>
                <BlogCallout title="Use com intenção" variant="info">
                    Essa opção altera a etapa final da experiência do cliente. Antes de divulgar o
                    cardápio, faça um pedido de teste no próprio celular com a mesma forma de
                    pagamento usada pelos clientes.
                </BlogCallout>
                <p>
                    Se o objetivo é estruturar todo o canal — cardápio, atendimento, confirmação e
                    operação — veja também o guia de{" "}
                    <Link
                        href="/blog/como-vender-delivery-pelo-whatsapp"
                        className="font-semibold text-brand hover:underline"
                    >
                        como vender delivery pelo WhatsApp sem perder pedidos
                    </Link>
                    .
                </p>
            </BlogSection>

            <BlogSection id="teste" title="Checklist rápido para testar no restaurante">
                <BlogSteps
                    items={[
                        {
                            title: "Ative a configuração",
                            description:
                                "Confirme no painel que “Forçar envio de Notificação no WhatsApp” está habilitado.",
                        },
                        {
                            title: "Abra o cardápio em um celular",
                            description:
                                "Faça o teste no navegador móvel real, porque é esse cenário que usa o fluxo auxiliar.",
                        },
                        {
                            title: "Escolha um pagamento que não seja Pix",
                            description:
                                "Finalize um pedido de teste com dinheiro ou outra forma compatível configurada pela loja.",
                        },
                        {
                            title: "Observe a passagem para o WhatsApp",
                            description:
                                "A tela intermediária pode aparecer enquanto o pedido é criado e, em seguida, deve encaminhar para o WhatsApp.",
                        },
                        {
                            title: "Confirme o pedido no painel",
                            description:
                                "Verifique se o pedido criado no iMenu corresponde ao pedido usado na confirmação.",
                        },
                    ]}
                />
                <p>
                    Para operações que também automatizam atendimento e respostas, o guia de{" "}
                    <Link
                        href="/blog/robo-whatsapp-para-restaurante"
                        className="font-semibold text-brand hover:underline"
                    >
                        robô de WhatsApp para restaurante
                    </Link>{" "}
                    explica como separar automação, cardápio e atendimento humano sem misturar os
                    papéis de cada etapa.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

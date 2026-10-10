import Link from "next/link";
import { faEye } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("cardapio-vitrine")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é o Cardápio Vitrine" },
    { id: "quando-usar", label: "Quando vale a pena usar" },
    { id: "links-diferentes", label: "Vitrine, delivery e mesas" },
    { id: "como-ativar", label: "Como ativar no iMenu" },
    { id: "como-compartilhar", label: "Como compartilhar o link" },
    { id: "mesmo-cardapio", label: "Atualização sem retrabalho" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "O cliente consegue fazer um pedido pelo Cardápio Vitrine?",
        answer: "Não. A Vitrine permite consultar produtos, fotos, descrições, preços e complementos, mas não oferece carrinho nem finalização de pedidos. Para receber pedidos online, compartilhe o link do delivery ou o acesso de uma mesa configurada para pedidos.",
    },
    {
        question: "Preciso de iMenu QR e IA Plus ao mesmo tempo?",
        answer: "Não. Basta ter acesso válido ao iMenu QR ou ao iMenu IA Plus. O Modo Vitrine está incluído em qualquer um desses planos, sem uma assinatura separada para a Vitrine.",
    },
    {
        question: "Ativar a Vitrine desativa meu delivery ou os pedidos das mesas?",
        answer: "Não. A Vitrine tem um endereço próprio e não muda o funcionamento dos outros cardápios. O delivery e as mesas continuam seguindo suas configurações e requisitos de acesso.",
    },
    {
        question: "O cliente precisa entrar em uma conta para consultar?",
        answer: "Não. Qualquer pessoa com o link pode abrir o Cardápio Vitrine, desde que o restaurante mantenha o modo ativado e tenha acesso válido a um dos planos que o incluem.",
    },
    {
        question: "Posso cadastrar produtos ou preços exclusivos para a Vitrine?",
        answer: "A Vitrine usa o mesmo catálogo do restaurante. O que é separado é o link e a experiência de consulta. Ela não cria outra lista de produtos ou uma tabela de preços independente.",
    },
    {
        question: "O que acontece se eu desativar o Modo Vitrine?",
        answer: "O endereço da Vitrine deixa de disponibilizar o cardápio. O mesmo acontece quando o restaurante fica sem acesso válido aos planos que incluem o recurso. Desativar a Vitrine não desativa o cardápio de delivery.",
    },
];

export default function CardapioVitrinePage() {
    return (
        <BlogArticle
            article={article}
            icon={faEye}
            takeaways={[
                "Um link para mostrar produtos e preços sem receber pedidos",
                "A diferença entre Vitrine, delivery e pedidos na mesa",
                "O caminho para ativar e compartilhar seu cardápio",
                "Um único catálogo para manter atualizado",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["cardapio-digital-qr-code-restaurante", "aplicativo-para-garcom", "como-montar-cardapio-delivery"]}
            ctaTitle="Apresente seu cardápio do jeito que sua operação precisa"
        >
            <BlogSection id="o-que-e" title="Seu cliente escolhe no celular. Sua equipe recebe o pedido.">
                <p>
                    Imagine uma cafeteria: o cliente senta, abre o cardápio no celular e
                    compara os cafés, os acompanhamentos e os preços. Depois, chama a
                    equipe para pedir. Você quer facilitar essa escolha, mas prefere que
                    o atendimento continue acontecendo na mesa ou no balcão.
                </p>
                <p>
                    <strong>O Modo Vitrine do iMenu foi feito para esse cenário.</strong>{" "}
                    Ele cria uma versão do seu cardápio exclusiva para visualização.
                    Produtos, fotos, descrições, preços e complementos ficam disponíveis
                    para consulta, sem carrinho ou finalização de pedidos.
                </p>
                <BlogCallout title="Um endereço próprio, com os produtos que você já cadastrou" variant="tip">
                    A Vitrine fica em <strong>/vitrine/nome-do-seu-restaurante</strong>.
                    O link de delivery continua funcionando no endereço habitual.
                    Você escolhe qual compartilhar em cada situação.
                </BlogCallout>
                <p>
                    Qualquer pessoa pode abrir o link, sem entrar em uma conta.
                    O acesso depende de a Vitrine estar ativada pelo restaurante e
                    de ele ter um dos planos que incluem o recurso.
                </p>
            </BlogSection>

            <BlogSection id="quando-usar" title="Quando um cardápio só para consulta faz sentido">
                <p>
                    A escolha começa pelo seu atendimento: quem deve receber o pedido
                    depois que o cliente decide? Se a resposta é sua equipe, a Vitrine
                    pode ser o caminho mais adequado para apresentar o menu.
                </p>
                <BlogSteps items={[
                    {
                        title: "Atendimento no salão",
                        description: "O cliente consulta o cardápio enquanto espera. O garçom recebe o pedido, esclarece dúvidas e pode sugerir uma combinação de acordo com a preferência da pessoa.",
                    },
                    {
                        title: "Escolha antes de chegar ao balcão",
                        description: "Em uma açaíteria, lanchonete ou cafeteria, o link permite conhecer tamanhos, sabores e complementos. A escolha é apresentada à equipe no momento do atendimento.",
                    },
                    {
                        title: "Apresentação dos produtos",
                        description: "Envie a Vitrine a quem quer conhecer o que o restaurante oferece antes de visitar ou conversar com você. O link serve como catálogo, sem iniciar um pedido online.",
                    },
                ]} />
                <BlogSubheading>Quando o objetivo é vender online, use o link de pedidos</BlogSubheading>
                <p>
                    Para uma divulgação de delivery em que você quer que o cliente
                    escolha, monte o carrinho e finalize, compartilhe o cardápio de
                    delivery. Se o objetivo é o próprio cliente enviar um pedido da
                    mesa, use o acesso daquela mesa. A Vitrine atende ao momento de
                    consulta; a escolha do link deve acompanhar o próximo passo esperado.
                </p>
            </BlogSection>

            <BlogSection id="links-diferentes" title="Vitrine, delivery e mesas: qual link compartilhar?">
                <p>
                    Os três acessos podem coexistir no mesmo restaurante. Ativar a
                    Vitrine não transforma seu delivery em catálogo e não desliga os
                    pedidos das mesas.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full min-w-[560px] text-left text-sm leading-6">
                        <caption className="sr-only">Diferenças entre os acessos ao cardápio do iMenu</caption>
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th scope="col" className="p-4 font-semibold">Acesso</th>
                                <th scope="col" className="p-4 font-semibold">O que o cliente faz</th>
                                <th scope="col" className="p-4 font-semibold">Quando compartilhar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {[
                                ["Vitrine", "Consulta produtos e preços, sem fazer pedidos.", "Quando o pedido será recebido pela sua equipe."],
                                ["Delivery", "Monta o carrinho e finaliza o pedido conforme as opções da loja.", "Quando você quer receber pedidos pelo cardápio."],
                                ["Mesa", "Envia um pedido vinculado à mesa configurada.", "Quando você oferece pedidos pelo celular no salão."],
                            ].map(([access, experience, use]) => (
                                <tr key={access}>
                                    <th scope="row" className="p-4 font-semibold text-gray-900">{access}</th>
                                    <td className="p-4">{experience}</td>
                                    <td className="p-4">{use}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p>
                    A Vitrine pode fazer parte do atendimento presencial mesmo que
                    o restaurante também receba pedidos de delivery. Você não precisa
                    escolher um único formato para toda a operação.
                </p>
            </BlogSection>

            <BlogSection id="como-ativar" title="Como ativar o Modo Vitrine no iMenu">
                <p>
                    O recurso está incluído no <strong>iMenu QR ou no iMenu IA Plus</strong>.
                    Basta ter acesso válido a um deles: não é necessário assinar os dois
                    e não existe uma assinatura separada para a Vitrine.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra Configurações",
                        description: <>No painel do restaurante, acesse <Link href="/painel/configuracoes" className="font-semibold text-brand underline">Configurações</Link>. O cartão Modo Vitrine aparece logo acima de Compartilhar Cardápio Delivery.</>,
                    },
                    {
                        title: "Se necessário, desbloqueie o acesso",
                        description: <>Se aparecer Desbloquear Modo Vitrine, o botão leva à página <Link href="/painel/planos" className="font-semibold text-brand underline">Planos</Link>. Escolha iMenu QR ou IA Plus de acordo com os outros recursos que você quer usar.</>,
                    },
                    {
                        title: "Ative o Modo Vitrine",
                        description: "Com o acesso liberado, use o botão de ativação no cartão. O link da Vitrine passa a aparecer na própria seção.",
                    },
                    {
                        title: "Abra e copie seu link",
                        description: "Use Abrir cardápio para ver a versão de consulta e Copiar link para compartilhar o endereço. O visitante consegue navegar pelos produtos sem fazer um pedido.",
                    },
                ]} />
                <BlogCallout title="O cardápio principal continua gratuito">
                    A condição de acesso é específica do Modo Vitrine. O cardápio digital
                    de delivery do iMenu continua gratuito, sem mensalidade, sem taxas
                    por pedido e sem limite de pedidos.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-compartilhar" title="Compartilhe com uma orientação que combine com o link">
                <p>
                    Em vez de anunciar “faça seu pedido aqui”, apresente a Vitrine como
                    um convite para conhecer o cardápio. Uma frase curta deixa claro
                    como o cliente deve seguir depois de escolher.
                </p>
                <BlogChecklist items={[
                    <span key="mesa"><strong>Na mesa:</strong> “Confira nosso cardápio no celular. Para pedir, chame nossa equipe.”</span>,
                    <span key="balcao"><strong>No balcão:</strong> “Veja os produtos e os preços. Faça seu pedido no balcão.”</span>,
                    <span key="whatsapp"><strong>No WhatsApp:</strong> “Aqui está nosso cardápio para você conhecer as opções antes de vir.”</span>,
                    <span key="redes"><strong>Nas redes sociais:</strong> “Conheça nosso cardápio e escolha o que provar na sua próxima visita.”</span>,
                ]} />
                <BlogSubheading>Também dá para usar o link em um QR Code</BlogSubheading>
                <p>
                    Copie o endereço da Vitrine e cole no{" "}
                    <Link href="/ferramentas/gerador-qr-code-cardapio" className="font-semibold text-brand underline">
                        gerador de QR Code para cardápio
                    </Link>. Você pode baixar o código para usar em um material de mesa
                    ou balcão. O que define a experiência é o endereço: um QR Code com
                    o link da Vitrine abre a consulta; um acesso de mesa configurado
                    para pedidos abre aquele fluxo.
                </p>
            </BlogSection>

            <BlogSection id="mesmo-cardapio" title="Um catálogo para atualizar, mais de uma forma de apresentar">
                <p>
                    Uma foto melhor, uma descrição mais clara ou um preço atualizado
                    devem chegar a quem consulta seu cardápio. A Vitrine usa os mesmos
                    produtos cadastrados no restaurante, então você não precisa manter
                    uma cópia do menu nem repetir as alterações em outro cadastro.
                </p>
                <BlogCallout title="Separado no acesso, compartilhado no conteúdo">
                    A Vitrine tem um link próprio e uma experiência sem pedidos.
                    Ela não cria produtos exclusivos nem preços diferentes dos demais
                    cardápios. As atualizações do catálogo também aparecem na Vitrine.
                </BlogCallout>
                <p>
                    Quando quiser retirar essa versão do ar, desative o Modo Vitrine
                    em Configurações. O endereço deixa de disponibilizar a consulta,
                    e seu cardápio de delivery continua seguindo as configurações
                    habituais. A Vitrine também precisa de acesso válido a um dos
                    planos que incluem o recurso para permanecer disponível.
                </p>
                <p>
                    Comece pelo lugar em que seu atendimento mais precisa de uma
                    consulta simples: uma mesa, o balcão ou uma conversa antes da visita.
                    Ative o modo, copie o link e apresente o cardápio com uma orientação
                    clara sobre como pedir à sua equipe.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

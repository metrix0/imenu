import Link from "next/link";
import { faRobot } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("robo-whatsapp-para-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é" },
    { id: "o-que-automatizar", label: "O que automatizar" },
    { id: "fluxo", label: "Fluxo ideal" },
    { id: "humano", label: "Bot + atendente" },
    { id: "configurar", label: "Como configurar" },
    { id: "erros", label: "Erros comuns" },
    { id: "metricas", label: "O que medir" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "O que um robô de WhatsApp para restaurante faz?",
        answer:
            "Ele automatiza dúvidas repetitivas e direciona o cliente para ações como abrir o cardápio, consultar pedido, verificar entrega, conferir pagamentos ou pedir atendimento humano.",
    },
    {
        question: "Chatbot de WhatsApp substitui o atendente?",
        answer:
            "Não precisa substituir. O melhor uso é automatizar perguntas previsíveis e transferir exceções, reclamações e casos específicos para uma pessoa.",
    },
    {
        question: "Preciso usar inteligência artificial no chatbot?",
        answer:
            "Não. Para restaurante, um fluxo simples e previsível costuma resolver boa parte do volume. IA pode ser útil em outros cenários, mas não é obrigatória para automatizar cardápio, status, entrega e pagamento.",
    },
    {
        question: "O robô pode informar onde está o pedido?",
        answer:
            "Sim, quando o sistema de pedidos e o WhatsApp estão integrados. No iMenu, o atendimento automático pode consultar um pedido recente vinculado ao mesmo número e responder o status atual.",
    },
];

export default function RoboWhatsappParaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faRobot}
            takeaways={[
                "Um modelo de chatbot que automatiza as dúvidas que mais se repetem",
                "Um fluxo claro para combinar robô e atendimento humano sem conflito",
                "Um checklist para configurar o WhatsApp antes de divulgar o número",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-vender-delivery-pelo-whatsapp",
                "controle-estoque-cardapio-digital",
                "programa-fidelidade-restaurante",
            ]}
            ctaTitle="Automatize o básico do WhatsApp e deixe a equipe cuidar das exceções"
        >
            <BlogSection id="o-que-e" title="Robô, chatbot ou atendimento automático no WhatsApp: qual é a diferença?">
                <p>
                    Na prática, esses nomes costumam apontar para a mesma ideia: um sistema
                    que recebe a mensagem do cliente e responde automaticamente sem exigir
                    que alguém da equipe digite tudo de novo. Para restaurante, o objetivo
                    não é criar uma conversa infinita com um robô. É resolver rápido o que
                    já tem resposta conhecida.
                </p>
                <p>
                    Perguntas como <strong>“qual é o cardápio?”</strong>, <strong>“vocês
                    entregam aqui?”</strong>, <strong>“aceita Pix?”</strong> e <strong>“onde
                    está meu pedido?”</strong> aparecem todos os dias. Quando cada uma exige
                    atendimento manual, o WhatsApp vira uma fila de tarefas repetitivas.
                </p>
                <BlogCallout title="Automação boa é previsível" variant="tip">
                    O cliente deve entender em poucos segundos o que o bot consegue fazer e
                    como falar com uma pessoa quando precisar.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="o-que-automatizar" title="O que vale a pena automatizar primeiro">
                <p>
                    Comece pelas perguntas que têm resposta objetiva e mudam pouco ao longo
                    da conversa. Elas entregam ganho imediato sem tentar transformar todo o
                    atendimento em automação.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        ["Cardápio e pedido", "Enviar o link correto do cardápio digital para o cliente consultar preços, adicionais e finalizar o pedido."],
                        ["Status do pedido", "Consultar o pedido recente do número e informar se está aguardando, em preparo, em rota, concluído ou cancelado."],
                        ["Entrega e retirada", "Mostrar taxas, faixas de distância, previsão, pedido mínimo e disponibilidade de retirada quando configurados."],
                        ["Formas de pagamento", "Responder quais meios de pagamento estão habilitados no restaurante e direcionar para a finalização do pedido."],
                        ["Atendimento humano", "Dar uma saída clara para reclamações, dúvidas específicas e qualquer situação que o fluxo automático não resolva."],
                        ["Repetição do menu", "Depois de cada resposta, oferecer novamente as ações principais para o cliente não ficar preso na conversa."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
                <p>
                    Esse é o tipo de fluxo que o <strong>robô de WhatsApp do iMenu</strong>
                    usa: cardápio, status, entrega, pagamento e transferência para a equipe.
                    O bot trabalha em cima das informações já configuradas no restaurante,
                    em vez de inventar respostas.
                </p>
            </BlogSection>

            <BlogSection id="fluxo" title="Fluxo ideal de um chatbot para restaurante">
                <BlogSteps
                    items={[
                        {
                            title: "Cliente manda a primeira mensagem",
                            description: "O robô se apresenta, explica o que consegue resolver e mostra as opções principais.",
                        },
                        {
                            title: "Cliente escolhe uma ação",
                            description: "Pode abrir o cardápio, consultar pedido, verificar entrega, conferir pagamentos ou pedir atendente.",
                        },
                        {
                            title: "Bot busca a informação correta",
                            description: "Em vez de responder com texto genérico, usa os dados configurados no restaurante ou o status real do pedido.",
                        },
                        {
                            title: "Cliente recebe uma resposta curta",
                            description: "A mensagem resolve a dúvida e, quando faz sentido, inclui o link do cardápio para continuar a compra.",
                        },
                        {
                            title: "Menu principal aparece novamente",
                            description: "O cliente pode fazer outra consulta sem precisar começar uma nova conversa.",
                        },
                        {
                            title: "Caso específico vai para a equipe",
                            description: "Quando o cliente pede atendimento humano, a automação deixa de disputar a conversa com o atendente.",
                        },
                    ]}
                />
                <BlogCallout title="Não transforme o bot em um labirinto" variant="warning">
                    Cinco ações úteis costumam ser melhores do que quinze menus. Quanto mais
                    níveis o cliente precisa atravessar, maior a chance de abandonar e pedir
                    “atendente”.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="humano" title="O segredo é combinar robô e atendimento humano">
                <p>
                    O maior medo de quem instala um chatbot é o robô continuar respondendo
                    enquanto uma pessoa tenta resolver o caso. Isso cria mensagens
                    duplicadas, respostas fora de contexto e uma experiência pior do que o
                    atendimento manual.
                </p>
                <p>
                    Por isso, o fluxo precisa ter um estado claro de <strong>atendimento
                    humano</strong>. No iMenu, quando a conversa passa para a equipe, o bot
                    fica fora daquela interação durante o período de atendimento. Se o dono
                    ou atendente assume a conversa, a automação também reconhece essa
                    tomada de controle.
                </p>
                <BlogChecklist
                    items={[
                        "Tenha uma opção explícita de “Falar com atendente”",
                        "Pare as respostas automáticas enquanto a equipe está atendendo",
                        "Use o bot para dúvidas repetitivas, não para discutir reclamações",
                        "Não esconda o acesso ao humano atrás de vários menus",
                        "Quando a automação não entender, mostre novamente as opções disponíveis",
                        "Mantenha cardápio, entrega e pagamentos atualizados para o bot responder certo",
                    ]}
                />
            </BlogSection>

            <BlogSection id="configurar" title="Como configurar um robô de atendimento no WhatsApp">
                <BlogSteps
                    items={[
                        {
                            title: "Organize o cardápio digital",
                            description: "Antes de automatizar o WhatsApp, corrija preços, disponibilidade, adicionais e link público do restaurante.",
                        },
                        {
                            title: "Defina entrega e retirada",
                            description: "Configure taxas, regiões ou faixas, tempo estimado, pedido mínimo e retirada para o bot ter o que responder.",
                        },
                        {
                            title: "Revise as formas de pagamento",
                            description: "Deixe habilitados apenas os meios realmente aceitos para evitar resposta automática incorreta.",
                        },
                        {
                            title: "Conecte o número",
                            description: "Faça a conexão do WhatsApp e confirme que a sessão aparece como conectada no painel.",
                        },
                        {
                            title: "Teste com outro celular",
                            description: "Simule primeira mensagem, menu, status de pedido, entrega, pagamento e transferência para atendente.",
                        },
                        {
                            title: "Só então divulgue",
                            description: "Depois do teste completo, use o número em Instagram, Google, embalagem e outros canais de aquisição.",
                        },
                    ]}
                />
                <p>
                    Se você ainda recebe pedidos inteiros pelo chat, vale combinar a
                    automação com um cardápio que coleta as escolhas do cliente. Veja também
                    nosso guia de {" "}
                    <Link href="/blog/como-vender-delivery-pelo-whatsapp" className="font-semibold text-brand underline">
                        como vender delivery pelo WhatsApp
                    </Link>.
                </p>
            </BlogSection>

            <BlogSection id="erros" title="Erros comuns ao automatizar atendimento de restaurante">
                <BlogSubheading>Responder tudo com inteligência artificial</BlogSubheading>
                <p>
                    Nem toda automação precisa interpretar texto livre. Se preço, taxa,
                    pagamento e status já existem no sistema, respostas determinísticas são
                    mais fáceis de testar e menos propensas a inventar informação.
                </p>
                <BlogSubheading>Automatizar informação desatualizada</BlogSubheading>
                <p>
                    Um bot rápido com dados errados continua sendo um atendimento ruim.
                    Quando preço, disponibilidade ou taxa mudarem, atualize a fonte usada
                    pelo robô.
                </p>
                <BlogSubheading>Esconder o atendente</BlogSubheading>
                <p>
                    Automação deve reduzir trabalho repetitivo, não impedir contato. Casos
                    como alteração de pedido, cobrança, atraso fora do normal ou problema na
                    entrega precisam de uma rota humana óbvia.
                </p>
                <BlogSubheading>Mandar textos enormes</BlogSubheading>
                <p>
                    WhatsApp é uma interface de leitura rápida. Responda a pergunta primeiro
                    e dê o próximo passo. Para detalhes do cardápio, prefira enviar o link em
                    vez de despejar dezenas de produtos na conversa.
                </p>
            </BlogSection>

            <BlogSection id="metricas" title="Como saber se o robô de WhatsApp está ajudando">
                <p>
                    O objetivo não é aumentar o número de mensagens automáticas. É reduzir o
                    esforço necessário para o cliente comprar e para a equipe atender.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Métrica</th>
                                <th className="px-5 py-4 font-bold">O que observar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Pedidos iniciados pelo WhatsApp</td><td className="px-5 py-4">Se o canal continua gerando intenção de compra.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Cliques no cardápio</td><td className="px-5 py-4">Se a automação leva o cliente para a etapa de escolha.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Pedidos de atendente</td><td className="px-5 py-4">Quais dúvidas ainda não estão sendo resolvidas pelo fluxo.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Erros repetidos</td><td className="px-5 py-4">Informações que precisam ser corrigidas no cardápio ou configuração.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Tempo até o pedido</td><td className="px-5 py-4">Se o cliente consegue sair da dúvida e chegar ao checkout mais rápido.</td></tr>
                        </tbody>
                    </table>
                </div>
            </BlogSection>
        </BlogArticle>
    );
}

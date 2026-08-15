import Link from "next/link";
import { faComments } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("como-vender-delivery-pelo-whatsapp")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "modelo", label: "O modelo certo" },
    { id: "configuracao", label: "Configuração" },
    { id: "fluxo", label: "Fluxo do pedido" },
    { id: "mensagens", label: "Mensagens prontas" },
    { id: "organizacao", label: "Organizar a equipe" },
    { id: "vender-mais", label: "Vender mais sem spam" },
    { id: "metricas", label: "Métricas" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como começar a vender delivery pelo WhatsApp?",
        answer:
            "Use um número comercial, complete o perfil, publique um cardápio online atualizado, defina entrega e pagamento e padronize as mensagens de confirmação. Antes de divulgar, faça pedidos de teste do início ao fim.",
    },
    {
        question: "É melhor enviar o cardápio em PDF ou por link?",
        answer:
            "Um link tende a ser mais seguro para a operação porque pode refletir preço e disponibilidade atuais sem reenviar arquivos. O PDF pode continuar circulando desatualizado e aumentar dúvidas no atendimento.",
    },
    {
        question: "Como evitar perder pedidos nas conversas?",
        answer:
            "Defina quais dados tornam o pedido completo, confirme o resumo antes de produzir e mova cada pedido por status visíveis. O chat pode ser o canal de contato, mas não deve ser o único controle da fila.",
    },
    {
        question: "Posso mandar promoções para qualquer contato?",
        answer:
            "Não. A política do WhatsApp exige permissão para contatos iniciados pela empresa e respeito aos pedidos para parar de receber mensagens. Trabalhe com consentimento claro e frequência útil, sem listas compradas ou disparos indiscriminados.",
    },
];

export default function ComoVenderDeliveryPeloWhatsappPage() {
    return (
        <BlogArticle
            article={article}
            icon={faComments}
            takeaways={[
                "Um fluxo de pedido que reduz perguntas e dados faltando",
                "Mensagens prontas para copiar e adaptar ao restaurante",
                "Métricas para melhorar conversão sem recorrer a spam",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-montar-cardapio-delivery",
                "alternativa-ao-ifood",
                "como-aumentar-ticket-medio-restaurante",
            ]}
            ctaTitle="Receba pedidos sem depender de conversa manual"
        >
            <BlogSection id="modelo" title="O WhatsApp deve abrir a conversa — não criar trabalho desnecessário">
                <p>
                    Vender pelo WhatsApp funciona melhor quando o cliente não precisa
                    perguntar preço, sabores, adicionais, taxa e prazo em mensagens
                    separadas. O papel do canal é facilitar a conversa e resolver exceções;
                    o <strong>cardápio online</strong> deve concentrar as escolhas e manter
                    as informações atualizadas.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
                        <p className="font-bold text-gray-950">Fluxo frágil</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            “Manda o cardápio” → arquivo antigo → várias perguntas → endereço
                            incompleto → total errado → cozinha recebe tarde.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
                        <p className="font-bold text-gray-950">Fluxo organizado</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Link atualizado → escolhas completas → resumo → confirmação →
                            produção → entrega ou retirada → pós-venda.
                        </p>
                    </div>
                </div>
                <BlogCallout title="Regra simples" variant="tip">
                    Toda informação repetida em várias conversas deve estar no cardápio ou
                    em uma resposta padronizada. Toda decisão específica daquele cliente
                    continua na conversa.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="configuracao" title="Configuração mínima antes de divulgar o número">
                <p>
                    Prepare o canal antes de trazer volume. Uma configuração incompleta
                    transforma cada novo pedido em improviso.
                </p>
                <BlogChecklist
                    items={[
                        "Nome, categoria, endereço e horário corretos no perfil comercial",
                        "Foto de perfil igual à identidade usada no cardápio e nas redes",
                        "Cardápio por link com preços e disponibilidade atuais",
                        "Mensagem de saudação com link e horário de atendimento",
                        "Resposta fora do horário informando quando a loja volta",
                        "Respostas rápidas para pagamento, entrega, prazo e retirada",
                        "Bairros, taxas e pedido mínimo definidos",
                        "Celular com energia, internet estável e responsável por turno",
                    ]}
                />
                <BlogSubheading>O que precisa estar claro no cardápio</BlogSubheading>
                <p>
                    Nome do item, tamanho ou porção, ingredientes principais, adicionais,
                    obrigatoriedade de escolhas, preço final, indisponibilidade e alerta
                    relevante de alergênicos quando aplicável. Quanto mais previsível a
                    escolha, menos correção acontece depois.
                </p>
                <BlogToolLink
                    href="/ferramentas/gerador-qr-code-cardapio"
                    title="Transforme o link do cardápio em QR Code"
                    description="Use em balcão, mesa, embalagem e material impresso — sempre testando o destino antes de imprimir."
                />
            </BlogSection>

            <BlogSection id="fluxo" title="Fluxo de pedido pelo WhatsApp, passo a passo">
                <BlogSteps
                    items={[
                        {
                            title: "Cliente acessa o cardápio",
                            description: "O link abre direto nos produtos, sem exigir que a pessoa procure um arquivo antigo na conversa.",
                        },
                        {
                            title: "Pedido chega com as escolhas",
                            description: "Itens, quantidade, tamanho, adicionais e observações precisam estar identificáveis.",
                        },
                        {
                            title: "Atendimento valida os dados",
                            description: "Confirme nome, telefone, entrega ou retirada, endereço completo, referência e pagamento.",
                        },
                        {
                            title: "Restaurante envia o resumo final",
                            description: "Liste itens, valores, taxa, total, pagamento e previsão. Produção só começa depois da confirmação.",
                        },
                        {
                            title: "Pedido entra na fila operacional",
                            description: "Registre status e horário. A cozinha não deve depender de rolar a tela do WhatsApp para descobrir o próximo pedido.",
                        },
                        {
                            title: "Cliente recebe atualizações úteis",
                            description: "Avise quando houver atraso relevante, saída para entrega ou disponibilidade para retirada.",
                        },
                        {
                            title: "Pedido é encerrado",
                            description: "Marque como concluído, resolva ocorrências e registre a origem para acompanhar recompra.",
                        },
                    ]}
                />
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                    <p className="font-bold text-gray-950">Um pedido só está completo quando contém</p>
                    <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                        <span>• Itens, quantidades e variações</span>
                        <span>• Nome e telefone</span>
                        <span>• Entrega ou retirada</span>
                        <span>• Endereço e referência</span>
                        <span>• Forma de pagamento e troco</span>
                        <span>• Taxa, total e prazo confirmados</span>
                    </div>
                </div>
            </BlogSection>

            <BlogSection id="mensagens" title="Mensagens prontas para copiar e adaptar">
                <p>
                    Mensagem pronta não deve parecer robótica. Ela deve garantir que a
                    informação importante não seja esquecida. Adapte o tom à sua marca e
                    mantenha campos entre colchetes para a equipe preencher.
                </p>
                <BlogSubheading>1. Primeira resposta</BlogSubheading>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-5 text-sm leading-7 text-gray-100">
                    <p className="whitespace-pre-line font-mono">
                        {`Oi, [nome]! 👋 Aqui é do [restaurante].\nNosso cardápio atualizado está aqui: [link]\nHoje atendemos até [horário], com entrega em [região] e retirada em [endereço]. Quando escolher, é só enviar o pedido.`}
                    </p>
                </div>
                <BlogSubheading>2. Pedido incompleto</BlogSubheading>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-5 text-sm leading-7 text-gray-100">
                    <p className="whitespace-pre-line font-mono">
                        {`Já separei os itens. Para fechar, me confirme por favor:\n• entrega ou retirada\n• endereço completo e referência\n• forma de pagamento\n• precisa de troco para qual valor?`}
                    </p>
                </div>
                <BlogSubheading>3. Confirmação final</BlogSubheading>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-5 text-sm leading-7 text-gray-100">
                    <p className="whitespace-pre-line font-mono">
                        {`Confirmação do pedido #[número]\n[itens e quantidades]\nSubtotal: [valor]\nEntrega: [valor]\nTotal: [valor]\nPagamento: [forma]\nDestino: [endereço ou retirada]\nPrevisão: [horário/faixa]\n\nEstá tudo certo? Assim que você confirmar, enviamos para a produção.`}
                    </p>
                </div>
                <BlogSubheading>4. Atraso</BlogSubheading>
                <div className="rounded-2xl border border-gray-200 bg-gray-950 p-5 text-sm leading-7 text-gray-100">
                    <p className="whitespace-pre-line font-mono">
                        {`Seu pedido #[número] teve um atraso de aproximadamente [tempo]. A nova previsão é [horário]. Desculpe pela espera — avisaremos assim que sair para entrega.`}
                    </p>
                </div>
                <BlogCallout title="Nunca confirme um prazo que a cozinha não consegue cumprir" variant="warning">
                    Uma resposta instantânea com previsão falsa piora mais a experiência do
                    que uma confirmação alguns minutos depois com prazo realista.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="organizacao" title="Como organizar a equipe para não perder conversas">
                <p>
                    Defina uma pessoa responsável por aceitar pedidos em cada turno e um
                    ponto claro de transferência para a produção. Se todos respondem e
                    ninguém é responsável, pedidos duplicados e esquecidos aparecem nos
                    horários de pico.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Status</th>
                                <th className="px-5 py-4 font-bold">O que significa</th>
                                <th className="px-5 py-4 font-bold">Próxima ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Novo</td><td className="px-5 py-4">Mensagem ainda não avaliada</td><td className="px-5 py-4">Responder e validar</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Aguardando</td><td className="px-5 py-4">Falta dado ou confirmação</td><td className="px-5 py-4">Não produzir ainda</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Confirmado</td><td className="px-5 py-4">Resumo aprovado</td><td className="px-5 py-4">Enviar para produção</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Produção</td><td className="px-5 py-4">Cozinha assumiu</td><td className="px-5 py-4">Acompanhar prazo</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Entrega/retirada</td><td className="px-5 py-4">Pedido pronto</td><td className="px-5 py-4">Despachar ou entregar</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Concluído</td><td className="px-5 py-4">Pedido finalizado</td><td className="px-5 py-4">Registrar ocorrência</td></tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Um {" "}
                    <Link href="/gestor-de-pedidos" className="font-semibold text-brand underline">
                        gestor de pedidos
                    </Link>{" "}
                    reduz a dependência da caixa de entrada e dá uma fila comum para
                    atendimento e produção.
                </p>
            </BlogSection>

            <BlogSection id="vender-mais" title="Como vender mais pelo WhatsApp sem virar spam">
                <p>
                    O crescimento saudável vem de facilitar a recompra, não de disparar o
                    máximo de mensagens possível. O WhatsApp informa que empresas só devem
                    iniciar contato com pessoas que forneceram o número e deram permissão,
                    além de respeitar pedidos de interrupção.
                </p>
                <BlogChecklist
                    items={[
                        "Peça consentimento de forma clara e registre a origem",
                        "Diga que tipo de mensagem será enviada e com qual frequência",
                        "Envie algo útil: cardápio do dia, disponibilidade ou condição real",
                        "Identifique o restaurante logo no início",
                        "Ofereça uma forma simples de parar de receber mensagens",
                        "Nunca compre listas nem adicione contatos sem autorização",
                    ]}
                />
                <p className="text-sm">
                    Consulte a {" "}
                    <a
                        href="https://business.whatsapp.com/policy?lang=pt_BR"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand underline"
                    >
                        Política de Mensagens do WhatsApp Business
                    </a>{" "}
                    antes de criar campanhas ou automações.
                </p>
                <BlogSubheading>Sugestões que ajudam o pedido</BlogSubheading>
                <p>
                    Depois que o cliente escolheu o principal, ofereça no máximo uma
                    sugestão contextual: bebida para a pizza, molho para a porção ou
                    sobremesa depois da refeição. A sugestão deve ser simples de aceitar e
                    trazer preço claro.
                </p>
            </BlogSection>

            <BlogSection id="metricas" title="Sete métricas para melhorar o canal">
                <BlogChecklist
                    items={[
                        "Conversas novas por dia e por origem",
                        "Percentual que vira pedido confirmado",
                        "Tempo até a primeira resposta",
                        "Tempo entre pedido e confirmação",
                        "Pedidos com informação faltando",
                        "Ticket médio e margem por pedido",
                        "Clientes que voltam a pedir em 30 dias",
                    ]}
                />
                <p>
                    Comece pelo gargalo dominante. Se muitas conversas não viram pedido,
                    revise link, cardápio, preço, prazo e primeira resposta. Se o pedido
                    entra mas atrasa, o problema está na fila operacional. Se vende bem e
                    sobra pouco, revise margem, taxas e descontos.
                </p>
                <BlogToolLink
                    href="/ferramentas/calculadora-ticket-medio"
                    title="Acompanhe o ticket médio do delivery"
                    description="Compare períodos, veja a variação e estime o impacto no faturamento sem confundir ticket com lucro."
                />
            </BlogSection>
        </BlogArticle>
    );
}

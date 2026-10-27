import Link from "next/link";
import { faUsers } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, { BlogCallout, BlogChecklist, BlogSection, BlogSteps, BlogSubheading } from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("crm-para-restaurantes")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é CRM para restaurantes" },
    { id: "dados", label: "Quais dados acompanhar" },
    { id: "segmentacao", label: "Segmentação de clientes" },
    { id: "recompra", label: "Como aumentar a recompra" },
    { id: "imenu", label: "CRM gratuito do iMenu" },
    { id: "automacoes", label: "Automações com iMenu Plus" },
    { id: "medir", label: "Como medir resultados" },
    { id: "plano", label: "Plano de ação de 30 dias" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    { question: "O que é CRM para restaurantes?", answer: "É a organização do histórico e das informações dos clientes para entender frequência, preferências e oportunidades de recompra, sem depender apenas da memória da equipe." },
    { question: "O CRM do iMenu é gratuito?", answer: "Sim. A área Clientes e seus dados de compras estão disponíveis gratuitamente. As automações de marketing pelo WhatsApp são recursos opcionais do iMenu Plus." },
    { question: "Como identificar clientes inativos?", answer: "Compare a data do último pedido com o padrão de recompra da sua loja. O iMenu também organiza clientes por segmentos como Novo, Frequente, Em risco e Inativo." },
    { question: "Preciso de uma lista manual de clientes?", answer: "Não para começar. Pedidos realizados no cardápio do iMenu alimentam automaticamente o CRM. Confira a qualidade dos contatos antes de qualquer campanha." },
    { question: "Posso enviar mensagens de marketing para todos os clientes?", answer: "Não. Respeite o consentimento do cliente, as regras aplicáveis e a possibilidade de não receber comunicações. Ter um telefone em um pedido não equivale a autorização irrestrita para marketing." },
    { question: "CRM e programa de fidelidade são a mesma coisa?", answer: "Não. O CRM ajuda a conhecer e segmentar a base; o programa de fidelidade oferece incentivos e recompensas. Podem funcionar juntos, mas cumprem papéis diferentes." },
];

export default function CrmParaRestaurantesPage() {
    return (
        <BlogArticle
            article={article}
            icon={faUsers}
            takeaways={[
                "O que acompanhar no histórico de compras para entender seu público",
                "Como distinguir clientes novos, frequentes, em risco e inativos",
                "O que o CRM do iMenu oferece de graça e o que depende do Plus",
                "Um plano de 30 dias para trabalhar recompra sem disparar mensagens indiscriminadas",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["imenu-plus", "programa-fidelidade-restaurante", "como-aumentar-ticket-medio-restaurante"]}
            ctaTitle="Conheça seus clientes e transforme pedidos em relacionamento"
        >
            <BlogSection id="o-que-e" title="CRM para restaurantes: conhecer o cliente antes de oferecer outra promoção">
                <p>
                    Um cliente pede uma pizza toda sexta-feira. Outro compra pela primeira vez e não volta.
                    Um terceiro já fazia pedidos toda semana, mas desapareceu há dois meses. Sem histórico organizado,
                    as três pessoas parecem iguais: apenas números de telefone. <strong>CRM para restaurantes</strong>
                    é usar dados dos pedidos para entender essa diferença e tomar decisões melhores.
                </p>
                <p>
                    CRM significa gestão do relacionamento com clientes. Na prática, é reunir informações
                    relevantes das compras, reconhecer padrões e escolher ações apropriadas. Não exige uma
                    operação sofisticada: uma pizzaria, uma lanchonete ou uma marmitaria já consegue começar
                    acompanhando frequência, recência e preferências.
                </p>
                <BlogCallout title="Relacionamento não é disparar mensagem para todo mundo" variant="tip">
                    Conhecer o cliente serve primeiro para melhorar a experiência e o atendimento.
                    Campanhas só fazem sentido com permissão para receber ofertas, uma mensagem relevante e
                    atenção à frequência dos contatos.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="dados" title="Quais informações são úteis em um CRM de restaurante?">
                <p>
                    O objetivo não é colecionar campos sem propósito. Comece com indicadores que respondem
                    perguntas comerciais reais: quem costuma voltar, o que prefere comprar, quanto gasta e
                    quando fez seu último pedido.
                </p>
                <BlogChecklist items={[
                    <span key="cadastro"><strong>Identificação e contato:</strong> nome e telefone informados no pedido, com o devido cuidado com dados pessoais.</span>,
                    <span key="historico"><strong>Histórico de compras:</strong> número de pedidos, datas e itens adquiridos.</span>,
                    <span key="gasto"><strong>Gasto total e ticket médio:</strong> quanto o cliente movimentou e o valor médio por compra.</span>,
                    <span key="favoritos"><strong>Produtos favoritos:</strong> itens mais recorrentes para compreender preferências.</span>,
                    <span key="recencia"><strong>Última compra:</strong> um sinal de quando o relacionamento pode estar esfriando.</span>,
                    <span key="padrao"><strong>Hábitos de consumo:</strong> dias e horários recorrentes, quando houver histórico suficiente.</span>,
                ]} />
                <BlogSubheading>Um exemplo simples</BlogSubheading>
                <p>
                    Dois clientes gastaram R$ 180 no mês. O primeiro fez seis pedidos de R$ 30; o segundo,
                    apenas um de R$ 180. O faturamento é igual, mas a frequência, a experiência e uma
                    eventual campanha podem ser muito diferentes. O ticket médio sozinho não conta a história.
                </p>
            </BlogSection>

            <BlogSection id="segmentacao" title="Segmentação: clientes novos, frequentes, em risco e inativos">
                <p>
                    Segmentos tornam a base compreensível sem abrir pedido por pedido. O iMenu identifica
                    perfis como <strong>Novo, Frequente, Destaque, Em risco e Inativo</strong> com base no
                    histórico disponível. São classificações para orientar a leitura, não julgamentos
                    permanentes sobre o valor de uma pessoa.
                </p>
                <BlogChecklist items={[
                    <span key="novo"><strong>Novo:</strong> merece uma primeira experiência clara, com cardápio simples e atendimento confiável.</span>,
                    <span key="frequente"><strong>Frequente:</strong> já demonstra hábito de compra; acompanhe consistência e preferências.</span>,
                    <span key="destaque"><strong>Destaque:</strong> alto volume ou gasto; mantenha qualidade e atenção ao relacionamento.</span>,
                    <span key="risco"><strong>Em risco:</strong> alguém que deixou de comprar recentemente; investigue motivos antes de presumir desinteresse.</span>,
                    <span key="inativo"><strong>Inativo:</strong> não compra há mais tempo; avalie se uma reaproximação consentida faz sentido.</span>,
                ]} />
                <p>
                    Não confunda segmentação com previsão garantida. A loja pode ter sazonalidade,
                    feriados, períodos de férias ou pedidos realizados por outro telefone.
                    Use o segmento como ponto de partida para olhar o histórico.
                </p>
            </BlogSection>

            <BlogSection id="recompra" title="Como usar o CRM para aumentar a recompra sem depender só de descontos">
                <p>
                    A recompra depende de produto, experiência, disponibilidade e conveniência. O CRM ajuda
                    a identificar onde agir, mas não substitui esses fundamentos. Uma entrega ruim não será
                    resolvida apenas por mais mensagens.
                </p>
                <BlogSteps items={[
                    { title: "Observe o que já funciona", description: "Quais produtos os clientes recorrentes compram? Os pedidos se concentram em certos dias? Confirme os padrões com o histórico." },
                    { title: "Facilite uma nova compra", description: "Mantenha o cardápio atualizado, os itens fáceis de encontrar e o canal de pedidos simples de compartilhar." },
                    { title: "Escolha um público específico", description: "Uma oferta para clientes inativos pode ser diferente de um lembrete para quem compra regularmente às sextas-feiras." },
                    { title: "Dê um motivo real para voltar", description: "Novidade no cardápio, combo coerente, atendimento confiável ou recompensa de fidelidade podem ser mais sustentáveis do que descontos contínuos." },
                    { title: "Meça antes de repetir", description: "Compare a recompra do grupo ao longo do tempo e avalie também o custo de qualquer incentivo." },
                ]} />
                <p>
                    Uma promoção pode aumentar pedidos e reduzir margem ao mesmo tempo. Se uma campanha
                    oferece R$ 10 de desconto, inclua esse custo na análise. Quando possível, compare
                    o desempenho com um período ou grupo semelhante, reconhecendo que nenhum desses
                    recortes prova causalidade por si só.
                </p>
            </BlogSection>

            <BlogSection id="imenu" title="Como funciona o CRM gratuito do iMenu">
                <p>
                    No iMenu, o cadastro do cliente é alimentado automaticamente pelos pedidos realizados
                    no cardápio. Na área <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes</Link>,
                    o restaurante pode consultar informações de compra, pesquisar pessoas e observar
                    segmentos. Não é necessário contratar o Plus apenas para acessar o CRM.
                </p>
                <p>
                    Ao abrir os detalhes de um cliente, é possível entender o histórico de pedidos,
                    produtos favoritos e hábitos de consumo identificados quando há dados suficientes.
                    O objetivo é evitar planilhas paralelas e facilitar a consulta na própria operação.
                    Os dados disponíveis dependem dos pedidos registrados e das informações fornecidas.
                </p>
                <BlogCallout title="CRM grátis, automações opcionais" variant="info">
                    O CRM e a visualização do histórico de clientes são gratuitos. O envio automático
                    de campanhas de recuperação, reativação e hábitos de compra pelo WhatsApp faz parte
                    do plano pago <Link href="/blog/imenu-plus" className="font-semibold text-brand underline">iMenu Plus</Link>.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="automacoes" title="Quando vale automatizar mensagens pelo WhatsApp?">
                <p>
                    Uma base organizada permite escolher campanhas específicas. Com o iMenu Plus, o
                    restaurante pode configurar <strong>recuperação de carrinho abandonado</strong>,
                    <strong> reativação de clientes inativos</strong> e <strong>lembretes por hábitos
                    de compra</strong>. São situações distintas e não devem usar a mesma abordagem.
                </p>
                <BlogChecklist items={[
                    <span key="carrinho"><strong>Carrinho abandonado:</strong> retomar uma compra não concluída, quando a automação estiver habilitada e houver condições de contato.</span>,
                    <span key="reativacao"><strong>Reativação:</strong> tentar reconectar quem não compra há um período, com mensagem e possível oferta pertinentes.</span>,
                    <span key="habito"><strong>Hábito:</strong> lembrar o cardápio antes de um horário recorrente identificado nas compras.</span>,
                    <span key="controle"><strong>Controle:</strong> configurar textos, ofertas e regras; observar o histórico de envios no painel.</span>,
                ]} />
                <p>
                    Essas mensagens dependem de WhatsApp conectado, configurações ativas e consentimento
                    do cliente para marketing. Não basta que a pessoa tenha informado um número ao pedir.
                    Leia também o <Link href="/blog/imenu-plus" className="font-semibold text-brand underline">guia do iMenu Plus</Link>
                    para entender o que está incluído.
                </p>
            </BlogSection>

            <BlogSection id="medir" title="Quatro indicadores para avaliar se o relacionamento está melhorando">
                <p>
                    Antes de testar uma mudança, defina um período de comparação. Não atribua toda
                    variação de vendas a uma campanha: clima, sazonalidade, preço, disponibilidade
                    e divulgação também influenciam.
                </p>
                <BlogChecklist items={[
                    <span key="recorrencia"><strong>Clientes que retornam:</strong> quantos fizeram mais de um pedido no período analisado.</span>,
                    <span key="frequencia"><strong>Frequência:</strong> quantas compras os clientes recorrentes realizam, em média.</span>,
                    <span key="ticket"><strong>Ticket médio:</strong> valor médio por pedido, sem confundi-lo com lucro.</span>,
                    <span key="inatividade"><strong>Tempo sem comprar:</strong> evolução dos segmentos em risco e inativos.</span>,
                ]} />
                <BlogSubheading>Exemplo de uma leitura honesta</BlogSubheading>
                <p>
                    Imagine 200 clientes identificados em um período, dos quais 60 voltaram a comprar.
                    A proporção observada é de 30%. Se no mês seguinte forem 35%, isso pode ser um
                    bom sinal, mas exige comparar grupos, datas e volume de clientes equivalentes.
                    Uma taxa melhor com menos pedidos totais pode não representar um crescimento saudável.
                </p>
            </BlogSection>

            <BlogSection id="plano" title="Plano de 30 dias para começar com CRM em seu restaurante">
                <BlogSteps items={[
                    { title: "Semana 1: organize o canal", description: "Confira cadastro, telefone informado nos pedidos, cardápio, informações dos produtos e a área Clientes do iMenu." },
                    { title: "Semana 2: entenda a base", description: "Observe clientes novos, frequentes, em risco e inativos. Identifique itens favoritos, horários e dúvidas recorrentes." },
                    { title: "Semana 3: escolha uma ação", description: "Melhore um ponto do atendimento, reveja um combo ou, com autorização de marketing e Plus, teste uma automação específica." },
                    { title: "Semana 4: confira o efeito", description: "Analise novos pedidos, frequência, ticket médio e custo de ofertas. Mantenha o que for útil e ajuste o restante." },
                ]} />
                <p>
                    O melhor CRM é aquele que ajuda a equipe a agir com consistência, não o que
                    exibe mais números. Para começar, abra <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes no iMenu</Link>,
                    identifique uma oportunidade e escolha um indicador que permita revisá-la.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

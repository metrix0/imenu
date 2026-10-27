import Link from "next/link";
import { faRocket } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, { BlogCallout, BlogChecklist, BlogSection, BlogSteps, BlogSubheading } from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("imenu-plus")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é iMenu Plus" },
    { id: "diferencas", label: "iMenu grátis vs. Plus" },
    { id: "marketing", label: "Automações de WhatsApp" },
    { id: "carrinho", label: "Recuperação de carrinho" },
    { id: "reativacao", label: "Reativação de clientes" },
    { id: "habitos", label: "Hábitos de compra" },
    { id: "assistente", label: "Assistente IA" },
    { id: "vendas", label: "Vendas IA" },
    { id: "bonus", label: "Bônus e recursos extras" },
    { id: "exemplo", label: "Exemplo de uma rotina" },
    { id: "preco", label: "Preço e contratação" },
    { id: "comecar", label: "Como começar e avaliar" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    { question: "O que é o iMenu Plus?", answer: "É o plano opcional do iMenu, que reúne automações de marketing pelo WhatsApp, recursos ampliados do Assistente IA, Vendas IA e bônus como upsells automáticos e download do cardápio em PDF." },
    { question: "Quanto custa o iMenu Plus?", answer: "O preço regular é R$ 49,99 por mês. Consulte o painel Planos para conferir as condições de contratação vigentes." },
    { question: "O iMenu continua gratuito?", answer: "Sim. O cardápio digital, o recebimento de pedidos, o Robô WhatsApp, o CRM, o QR Code Mesa, o Painel Garçom e outros recursos gratuitos continuam disponíveis sem contratar o iMenu Plus." },
    { question: "O WhatsApp automático de marketing é gratuito?", answer: "O Robô WhatsApp do cardápio é gratuito. Recuperação de carrinho, reativação e mensagens por hábitos de compra são automações de marketing incluídas no iMenu Plus e exigem as condições de envio, como conexão e consentimento." },
    { question: "O Assistente IA só funciona com iMenu Plus?", answer: "Não. Existe acesso gratuito ao Assistente IA, inclusive para geração de imagens, dentro das condições aplicáveis. O Plus amplia a capacidade e o acesso." },
    { question: "O Vendas IA altera o cardápio sozinho?", answer: "Não. A análise identifica oportunidades e pode preparar propostas. A aplicação das alterações depende de revisão e aprovação do restaurante." },
    { question: "Preciso pagar pelo QR Code na mesa?", answer: "Não. QR Code Mesa e Painel Garçom são gratuitos e independentes do iMenu Plus." },
    { question: "Posso baixar o cardápio em PDF sem Plus?", answer: "O download do cardápio em PDF é um benefício exclusivo do iMenu Plus." },
    { question: "O iMenu Plus garante aumento de vendas?", answer: "Não. As ferramentas podem ajudar a identificar e trabalhar oportunidades, mas o resultado depende do público, das ofertas, da operação e da execução do restaurante." },
];

export default function IMenuPlusPage() {
    return (
        <BlogArticle
            article={article}
            icon={faRocket}
            takeaways={[
                "O que está incluído no iMenu Plus e o que continua gratuito",
                "Como funcionam recuperação de carrinho, reativação e hábitos de compra no WhatsApp",
                "Como usar Assistente IA e Vendas IA para revisar melhorias antes de aplicá-las",
                "Preço, bônus e um roteiro para avaliar o plano no seu restaurante",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["crm-para-restaurantes", "assistente-ia-para-restaurante", "analise-de-vendas-com-ia"]}
            ctaTitle="Conheça o iMenu Plus e veja como ativar no seu restaurante"
        >
            <BlogSection id="o-que-e" title="iMenu Plus: automações, inteligência artificial e mais oportunidades de venda">
                <p>
                    Atrair um novo pedido é importante. Fazer o cliente voltar, oferecer um complemento
                    relevante e manter um cardápio bem organizado pode ser igualmente importante para o
                    resultado do restaurante. O <strong>iMenu Plus</strong> reúne ferramentas para trabalhar
                    essas oportunidades no mesmo sistema em que a loja recebe e acompanha pedidos.
                </p>
                <p>
                    O plano combina três frentes: <strong>Automações de Marketing WhatsApp</strong>,
                    <strong> Assistente IA</strong> e <strong>Vendas IA</strong>. As automações apoiam
                    a comunicação com clientes; o Assistente ajuda a preparar melhorias no cardápio;
                    e o Vendas IA usa os dados da operação para identificar oportunidades. Há também
                    benefícios extras para recomendações de produtos e acompanhamento de pedidos.
                </p>
                <p>
                    A proposta não é substituir quem conhece a loja. O restaurante continua decidindo
                    preços, promoções e mudanças relevantes. A tecnologia organiza informações,
                    prepara ações e reduz parte do trabalho repetitivo, mas nenhuma ferramenta garante
                    um aumento específico de faturamento.
                </p>
                <BlogCallout title="O iMenu gratuito continua existindo" variant="tip">
                    O Plus é opcional. Você não precisa assiná-lo para ter cardápio digital, pedidos,
                    QR Code Mesa, Painel Garçom, CRM, Robô WhatsApp ou os demais recursos gratuitos
                    do iMenu. O plano amplia possibilidades de marketing e IA.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="diferencas" title="iMenu grátis ou iMenu Plus: o que muda?">
                <p>
                    Antes de contratar, diferencie os recursos essenciais de pedidos daqueles voltados
                    a crescimento. O <strong>iMenu gratuito</strong> serve para criar o cardápio,
                    receber pedidos, organizar a operação e manter registros de clientes. O
                    <strong> iMenu Plus</strong> adiciona funcionalidades que trabalham a relação
                    com a base e as oportunidades identificadas nos dados da loja.
                </p>
                <BlogChecklist items={[
                    <span key="cardapio"><strong>Gratuito:</strong> cardápio digital, pedidos delivery, retirada, QR Code Mesa e Painel Garçom.</span>,
                    <span key="crm"><strong>Gratuito:</strong> CRM com histórico dos clientes, cupons, promoções e recursos de gestão.</span>,
                    <span key="robo"><strong>Gratuito:</strong> Robô WhatsApp para o fluxo de atendimento do cardápio, separado das campanhas de marketing.</span>,
                    <span key="assist"><strong>Gratuito com condições de uso:</strong> Assistente IA, inclusive geração de imagens, e visualização de análises gratuitas quando disponíveis.</span>,
                    <span key="marketing"><strong>Plus:</strong> mensagens automáticas de marketing para carrinho, reativação e hábitos de compra.</span>,
                    <span key="vendas"><strong>Plus:</strong> acesso ampliado ao Assistente e ao Vendas IA, incluindo revisão e aplicação de melhorias aprovadas.</span>,
                ]} />
                <p>
                    Uma diferença importante: o <strong>CRM não é um bônus pago</strong>. O histórico
                    das compras já pode ajudar a equipe gratuitamente. O Plus entra quando a loja quer
                    automatizar ações de marketing ou ampliar o trabalho com IA. Veja também
                    o <Link href="/blog/crm-para-restaurantes" className="font-semibold text-brand underline">guia de CRM para restaurantes</Link>.
                </p>
            </BlogSection>

            <BlogSection id="marketing" title="Automações de Marketing WhatsApp: falar com o público certo">
                <p>
                    Mandar a mesma oferta para toda a base tende a ignorar o momento de cada cliente.
                    No iMenu Plus, as automações trabalham três situações distintas: a compra que não
                    terminou, o cliente que deixou de voltar e o padrão de compra que pode inspirar
                    um lembrete oportuno.
                </p>
                <p>
                    Na área <Link href="/painel/marketing" className="font-semibold text-brand underline">Marketing</Link>,
                    o restaurante pode configurar regras, textos e ofertas opcionais, além de acompanhar
                    envios. A execução depende de WhatsApp conectado, configurações ativas,
                    consentimento para receber marketing e demais condições de entrega.
                    A existência de um telefone no pedido não autoriza campanhas indiscriminadas.
                </p>
                <BlogCallout title="Robô WhatsApp e marketing são coisas diferentes" variant="info">
                    O Robô WhatsApp gratuito ajuda no atendimento e no fluxo dos pedidos.
                    As <strong>automações de marketing</strong> do Plus têm outro objetivo:
                    incentivar uma compra futura ou retomar uma oportunidade comercial.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="carrinho" title="1. Recuperação de carrinho abandonado: retomar uma escolha interrompida">
                <p>
                    Imagine um cliente que adiciona um hambúrguer e uma bebida, mas não conclui
                    o pedido. Em vez de assumir que ele nunca mais voltará, a loja pode usar a
                    automação de recuperação para enviar uma lembrança adequada quando as regras
                    e as condições de contato forem atendidas.
                </p>
                <p>
                    A mensagem deve ser clara e respeitosa. Algo como “Você deixou itens no carrinho;
                    se ainda quiser, nosso cardápio está disponível” já comunica o motivo do contato.
                    Uma oferta é opcional: conceder desconto em toda recuperação pode reduzir a
                    margem sem necessariamente criar compras adicionais.
                </p>
                <BlogSubheading>O que acompanhar</BlogSubheading>
                <p>
                    Observe se clientes retornam e concluem pedidos, mas avalie também a margem e o
                    custo das ofertas. Um carrinho abandonado não significa necessariamente falha:
                    a pessoa pode estar comparando opções ou simplesmente ter mudado de ideia.
                    Não prometa recuperação de todos os carrinhos.
                </p>
            </BlogSection>

            <BlogSection id="reativacao" title="2. Reativação de clientes inativos: dar um motivo para voltar">
                <p>
                    Um cliente que comprava com frequência pode interromper os pedidos por mudança
                    de rotina, preço, experiência ou por um motivo que a loja desconhece.
                    A reativação permite trabalhar esse grupo com uma mensagem dedicada, em vez
                    de misturá-lo aos compradores recorrentes.
                </p>
                <p>
                    Um convite útil pode apresentar um produto novo, relembrar um favorito ou
                    comunicar uma condição especial real. Seja honesto sobre o benefício oferecido
                    e evite pressão. Se a loja não consegue atender no horário anunciado, a campanha
                    pode prejudicar a experiência em vez de ajudar.
                </p>
                <p>
                    O CRM organiza os segmentos de clientes; a automação de reativação é um recurso
                    pago do Plus. O envio continua condicionado a consentimento e à configuração
                    do canal. Avalie o retorno junto com a frequência de compra e o custo da campanha.
                </p>
            </BlogSection>

            <BlogSection id="habitos" title="3. Hábitos de compra: estar presente quando o cliente costuma pedir">
                <p>
                    Alguns consumidores repetem padrões: uma marmita perto do almoço, uma pizza
                    na sexta-feira ou um lanche no domingo. Quando existe histórico suficiente,
                    o iMenu pode reconhecer hábitos de dia e horário para apoiar uma comunicação
                    no momento apropriado.
                </p>
                <p>
                    O objetivo é relevância, não adivinhar o próximo pedido. Um padrão passado
                    não garante que alguém vá comprar de novo. A loja pode configurar o lembrete
                    e decidir se inclui uma oferta, sempre respeitando a autorização do cliente
                    para comunicação comercial.
                </p>
                <BlogCallout title="Evite transformar um hábito em excesso de mensagens" variant="tip">
                    Selecione uma ação específica, acompanhe o histórico de envios e não insista
                    indiscriminadamente. A confiança do cliente vale mais do que um disparo extra.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="assistente" title="Assistente IA: transforme pedidos em propostas para seu cardápio">
                <p>
                    O <Link href="/blog/assistente-ia-para-restaurante" className="font-semibold text-brand underline">Assistente IA</Link>
                    ajuda o restaurante a trabalhar com informações do cardápio em linguagem natural.
                    Você pode pedir descrições mais claras, corrigir nomes, reorganizar produtos,
                    preparar alterações de preços definidos por você, revisar complementos ou
                    gerar imagens de produtos, logo e banner para aprovação.
                </p>
                <p>
                    Por exemplo: “Reescreva a descrição do meu hambúrguer vegetariano, sem acrescentar
                    ingredientes” ou “Prepare uma prévia de imagem que mostre exatamente a porção que
                    vendo”. A IA apresenta o conteúdo ou uma proposta de alteração; <strong>o restaurante
                    revisa e aprova antes da aplicação</strong>. Uma imagem gerada não é publicada
                    automaticamente apenas por ter sido criada.
                </p>
                <p>
                    O Assistente possui uma modalidade de acesso gratuito, inclusive para imagens,
                    nas condições aplicáveis. O iMenu Plus amplia o acesso e a capacidade para quem
                    precisa usar essas ferramentas com maior frequência. Não é necessário assinar
                    apenas para descobrir como o Assistente funciona.
                </p>
            </BlogSection>

            <BlogSection id="vendas" title="Vendas IA: transformar histórico de pedidos em oportunidades concretas">
                <p>
                    A análise de vendas não se resume a uma lista dos itens mais vendidos. O
                    <Link href="/blog/analise-de-vendas-com-ia" className="font-semibold text-brand underline"> Vendas IA</Link>
                    considera informações do cardápio e dos pedidos para apontar oportunidades
                    de melhoria, como apresentação de produtos, organização, descrições,
                    combinações e recomendações relacionadas à operação.
                </p>
                <p>
                    Uma análise pode sugerir, por exemplo, destacar um item com boa saída,
                    melhorar uma descrição confusa ou considerar um complemento pertinente.
                    Quando existirem evidências e hipóteses para uma estimativa, elas devem
                    ser tratadas como cenário, não como lucro ou faturamento garantido.
                </p>
                <p>
                    A visualização de análises pode ser disponibilizada gratuitamente conforme o
                    acesso da loja. O Plus permite acesso mais amplo às oportunidades, conversar
                    sobre elas e <strong>revisar e aplicar propostas depois da aprovação</strong>.
                    Nenhuma sugestão deve alterar a operação sem que o dono confira seu conteúdo.
                </p>
                <BlogSubheading>Por que revisão é indispensável?</BlogSubheading>
                <p>
                    A IA pode ajudar com texto e estrutura, mas só o restaurante conhece todos os
                    custos, a disponibilidade real dos ingredientes e a expectativa do público.
                    Uma alteração de preço sem conferir margem, ou uma foto que promete mais do
                    que a porção entregue, pode atrapalhar a confiança do consumidor.
                </p>
            </BlogSection>

            <BlogSection id="bonus" title="O que mais está incluído no iMenu Plus?">
                <p>
                    Além dos três recursos principais, o plano apresenta quatro bônus: atendimento
                    exclusivo, upsells automáticos, atualizações de pedidos pelo WhatsApp e download
                    do cardápio em PDF. Eles complementam, mas não substituem, as ferramentas grátis.
                </p>
                <BlogChecklist items={[
                    <span key="suporte"><strong>Atendimento exclusivo:</strong> canal para solicitar integrações e funcionalidades, sujeito à avaliação da equipe; solicitação não é garantia de implementação.</span>,
                    <span key="upsell"><strong>Upsells automáticos:</strong> recomendações de produtos que combinam com a compra, buscando oportunidades de aumentar o ticket médio.</span>,
                    <span key="status"><strong>Atualizações pelo WhatsApp:</strong> avisos de andamento do pedido conforme as condições de conexão, elegibilidade e envio aplicáveis.</span>,
                    <span key="pdf"><strong>Download do cardápio em PDF:</strong> exportação para imprimir ou compartilhar, exclusiva do iMenu Plus.</span>,
                ]} />
                <p>
                    Atenção à diferença entre <strong>upsell manual</strong> e automático:
                    recomendações configuradas manualmente continuam gratuitas; o recurso
                    que sugere automaticamente itens compatíveis pertence ao Plus.
                </p>
                <p>
                    QR Code Mesa, Painel Garçom, Modo Vitrine e importação de cardápio com IA
                    não são bônus pagos. Esses recursos continuam gratuitos e não exigem
                    assinatura do iMenu Plus.
                </p>
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo prático: como as ferramentas se complementam em uma hamburgueria">
                <p>
                    Pense em uma hamburgueria que já recebe pedidos pelo cardápio digital e quer
                    melhorar a recompra. O primeiro passo não precisa ser uma campanha: é olhar
                    quais itens são mais vendidos, como os clientes retornam e quais produtos
                    podem ser apresentados com mais clareza.
                </p>
                <BlogSteps items={[
                    { title: "Leia a base", description: "Na área Clientes, confira histórico, favoritos e segmentos. Este passo usa o CRM gratuito." },
                    { title: "Escolha a oportunidade", description: "No Vendas IA, revise as sugestões disponíveis e identifique um ajuste realista para a operação." },
                    { title: "Prepare a mudança", description: "Peça ao Assistente IA uma descrição melhor ou uma prévia de imagem fiel ao produto. Confira e aprove antes de aplicar." },
                    { title: "Configure a comunicação", description: "Se fizer sentido, ative uma automação de marketing do Plus para um público e um objetivo específicos, com consentimento." },
                    { title: "Acompanhe os próximos pedidos", description: "Observe pedidos, retorno dos clientes e margem dos itens afetados, sem atribuir toda oscilação à campanha." },
                ]} />
                <p>
                    Esse fluxo não promete que um cliente vai gastar mais. Ele cria uma rotina em
                    que os dados orientam hipóteses, as ações são revisadas e o resultado volta
                    a ser acompanhado pela própria equipe.
                </p>
            </BlogSection>

            <BlogSection id="preco" title="Quanto custa o iMenu Plus e como contratar?">
                <p>
                    O preço regular do iMenu Plus é de <strong>R$ 49,99 por mês</strong>.
                    Trata-se de uma assinatura opcional, distinta dos recursos gratuitos do
                    cardápio. A página <Link href="/painel/planos" className="font-semibold text-brand underline">Planos</Link>
                    mostra as condições e o fluxo de contratação disponíveis para cada loja.
                </p>
                <p>
                    Ao comparar custos, olhe para o uso real: se o restaurante vai configurar as
                    campanhas, revisar análises e aplicar melhorias úteis. Assinar sem dedicar
                    atenção às oportunidades não cria resultados por si só. Também não confunda
                    preço da assinatura com custos de matéria-prima ou de descontos concedidos.
                </p>
                <BlogCallout title="Antes de assinar" variant="info">
                    Confira a situação do seu restaurante em Planos, leia as condições vigentes
                    e confirme os recursos que pretende usar. A contratação do Plus não é requisito
                    para continuar recebendo pedidos no iMenu gratuito.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="comecar" title="Como começar a usar iMenu Plus com um objetivo mensurável">
                <p>
                    O erro mais comum é ativar várias iniciativas ao mesmo tempo e perder a
                    referência do que está funcionando. É melhor escolher um objetivo concreto,
                    como reativar clientes antigos ou melhorar a apresentação dos itens
                    com maior saída, e acompanhar seus indicadores.
                </p>
                <BlogSteps items={[
                    { title: "Defina um problema", description: "Escolha entre recompra, carrinhos interrompidos, apresentação do cardápio ou sugestões de produtos. Evite perseguir tudo de uma vez." },
                    { title: "Verifique os dados e o canal", description: "Confira pedidos, cardápio, WhatsApp conectado e consentimento para marketing quando a ação envolver mensagens." },
                    { title: "Ative apenas o necessário", description: "Configure uma automação ou prepare uma melhoria com IA, sempre revisando os textos, a oferta e as regras." },
                    { title: "Estabeleça uma comparação", description: "Observe pedidos, recorrência, ticket médio e custos antes e depois, considerando sazonalidade e variações de volume." },
                    { title: "Revise e ajuste", description: "Se a ação não ajuda, modifique-a ou desative-a. O plano deve servir à operação, e não gerar mais tarefas sem retorno." },
                ]} />
                <p>
                    Quer ver o que está disponível? Abra <Link href="/painel/planos" className="font-semibold text-brand underline">iMenu Plus no painel</Link>.
                    Para entender a base de clientes, leia o <Link href="/blog/crm-para-restaurantes" className="font-semibold text-brand underline">guia de CRM</Link>.
                    Para aplicar melhorias no cardápio, conheça o <Link href="/blog/assistente-ia-para-restaurante" className="font-semibold text-brand underline">Assistente IA</Link>
                    e o <Link href="/blog/analise-de-vendas-com-ia" className="font-semibold text-brand underline">Vendas IA</Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

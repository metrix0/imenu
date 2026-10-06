import Link from "next/link";
import { faChartLine } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("analise-de-vendas-com-ia")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "dados-viram-acoes", label: "Das vendas à mudança aplicada" },
    { id: "o-que-analisa", label: "O que a IA analisa" },
    { id: "oportunidades", label: "Como uma oportunidade vira ação" },
    { id: "estimativa", label: "Como entender o potencial em reais" },
    { id: "comparacoes", label: "Comparações e resultados" },
    { id: "aplicacao", label: "Revisar e aplicar" },
    { id: "acesso", label: "Análise gratuita e IA Plus" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    { question: "O Vendas IA é gratuito?", answer: "A aba e a liberação de análises gratuitas estão disponíveis sem contratar IA Plus. Atualmente, elas são liberadas para restaurantes selecionados por vez. O IA Plus oferece acesso completo, aplicação das propostas e acesso à análise sem depender da seleção gratuita." },
    { question: "O que a análise considera?", answer: "A IA considera os dados disponíveis de pedidos, produtos, cardápio, fotos, preços e configurações. Quando disponíveis, também usa informações de tráfego, comparações com restaurantes parecidos e histórico de ações. Dados ausentes limitam as conclusões." },
    { question: "A IA aplica as melhorias automaticamente?", answer: "Com IA Plus, você pode revisar as propostas e confirmar a aplicação. Depois da aprovação, o iMenu executa as mudanças compatíveis no restaurante. A análise, por si só, não altera produtos, preços ou configurações." },
    { question: "O valor estimado é uma promessa de faturamento?", answer: "Não. É uma projeção baseada em dados observados e hipóteses de adesão ou melhora. Ela não garante vendas nem lucro e pode incluir apenas parte das oportunidades identificadas." },
    { question: "Posso conversar sobre uma recomendação antes de aprovar?", answer: "Sim, com IA Plus. A conversa sobre a oportunidade usa o contexto da análise para esclarecer a recomendação ou preparar ajustes antes de você decidir o que aplicar." },
    { question: "Uma análise mais rápida significa resultado imediato?", answer: "Não. O IA Plus permite acessar a análise sem esperar a seleção gratuita, mas a preparação ainda depende do processamento e da disponibilidade do serviço. Não há um prazo fixo prometido neste guia." },
];

export default function AnaliseDeVendasComIaPage() {
    return (
        <BlogArticle
            article={article}
            icon={faChartLine}
            takeaways={[
                "O que seus pedidos e seu cardápio podem revelar juntos",
                "Como identificar prioridades com evidências do restaurante",
                "Como aprovar melhorias que o iMenu aplica automaticamente",
                "Como interpretar projeções sem confundir receita com lucro",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["assistente-ia-para-restaurante", "como-aumentar-ticket-medio-restaurante", "como-criar-combo-no-delivery"]}
            ctaTitle="Descubra a oportunidade. Aprove a mudança. Coloque seu cardápio para trabalhar."
        >
            <BlogSection id="dados-viram-acoes" title="Seu cardápio vende todos os dias. O que ele está deixando passar?">
                <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0 space-y-5">
                        <p>
                            Um hambúrguer vende bem, mas quase ninguém adiciona bebida. Um combo já tem procura,
                            mas aparece no fim do cardápio. Um kit anuncia três unidades e permite escolher só
                            uma. Cada caso pede uma decisão diferente — e o total de vendas, sozinho,
                            não explica qual ajuste merece sua atenção.
                        </p>
                        <p>
                            O <strong>Vendas IA do iMenu transforma os dados disponíveis do restaurante em uma
                            análise de oportunidades</strong>. Ele cruza pedidos, desempenho dos produtos,
                            apresentação do cardápio e configurações para indicar o que pode melhorar e por quê.
                        </p>
                    </div>
                    <figure className="w-full max-w-xs justify-self-center overflow-hidden rounded-3xl border border-orange-100 bg-orange-50/40 p-4 shadow-sm">
                        <img src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="iMenu IA Plus" width={950} height={199} className="mx-auto mb-4 h-auto w-40 max-w-full" />
                        <img src="/images/IAPlus.png" alt="Representação dos recursos de IA do iMenu com uma proposta de mudança no cardápio aguardando aprovação" width={1602} height={1823} className="mx-auto block h-auto w-full rounded-2xl" />
                    </figure>
                </div>
                <BlogCallout title="O diagnóstico pode chegar com a mudança pronta" variant="tip">
                    Com iMenu IA Plus, as recomendações executáveis vêm com propostas para revisão.
                    Depois que você aprova, o sistema aplica as alterações automaticamente.
                    Uma oportunidade pode sair do relatório e entrar no seu cardápio sem você editar cada campo.
                </BlogCallout>
                <p>
                    O objetivo é ajudar a decidir e executar: saber qual produto merece destaque,
                    qual informação está atrapalhando a escolha ou qual configuração precisa ser
                    confirmada antes de mexer. O relatório dá o contexto; a proposta prepara o trabalho.
                </p>
            </BlogSection>

            <BlogSection id="o-que-analisa" title="Pedidos, cardápio e fotos vistos como parte da mesma venda">
                <p>
                    Uma boa análise precisa considerar o que você oferece e o que o cliente compra.
                    Por isso, a IA examina várias dimensões do restaurante. A profundidade de cada
                    conclusão depende dos dados disponíveis e do que foi possível verificar.
                </p>
                <BlogChecklist items={[
                    <span key="vendas"><strong>Vendas e produtos:</strong> demanda, receita, ticket e participação dos itens nos pedidos.</span>,
                    <span key="ordem"><strong>Ordem e visibilidade:</strong> posição de categorias e produtos que já têm procura.</span>,
                    <span key="clareza"><strong>Nomes e descrições:</strong> escrita, ingredientes, porções e diferenças que ajudam o cliente a escolher.</span>,
                    <span key="foto"><strong>Imagens:</strong> ausência de foto e avaliação visual das fotos carregadas, incluindo nitidez e enquadramento.</span>,
                    <span key="ofertas"><strong>Preços, combos e adicionais:</strong> coerência das ofertas existentes e oportunidades no carrinho.</span>,
                    <span key="config"><strong>Configurações:</strong> escolhas obrigatórias, duplicidades, promoções, fidelidade, horários e entrega.</span>,
                ]} />
                <BlogSubheading>Uma foto de um produto importante merece atenção diferente</BlogSubheading>
                <p>
                    O sistema prioriza produtos mais vendidos no carregamento das fotos. Uma imagem
                    pequena ou pouco legível de um produto procurado pode justificar uma proposta de
                    melhoria. Se uma foto não puder ser aberta, a análise deve reconhecer essa ausência,
                    sem afirmar que avaliou o que não viu.
                </p>
                <p>
                    O mesmo vale para as ofertas. A IA deve olhar os combos que já existem antes de
                    recomendar mudanças. Acrescentar mais opções ao cardápio ou reduzir preços não é
                    uma solução automática: a recomendação precisa fazer sentido para os dados e a operação.
                </p>
            </BlogSection>

            <BlogSection id="oportunidades" title="O que você recebe: uma prioridade, a evidência e a proposta">
                <p>
                    O relatório reúne um resumo, prioridades e pontos que precisam da decisão do dono.
                    Nas oportunidades, você pode abrir as evidências e entender quais dados sustentam
                    a recomendação. As propostas mostram os itens e as mudanças preparadas.
                </p>
                <BlogSteps items={[
                    { title: "Bebidas no carrinho", description: "Exemplo: há pedidos sem bebida e opções disponíveis no cardápio. A IA pode propor sugestões no carrinho usando os produtos existentes. A seleção precisa fazer sentido para o conjunto de clientes, pois as sugestões do carrinho são gerais." },
                    { title: "Um kit com a quantidade certa", description: "Exemplo: uma oferta anuncia três hambúrgueres, mas exige só uma escolha. A proposta pode corrigir a seleção mínima e esclarecer o texto, preservando o conteúdo real da oferta." },
                    { title: "Um combo que merece ser encontrado", description: "Exemplo: uma categoria tem vendas, mas aparece depois de várias outras. A IA pode propor uma nova posição. Ter demanda não prova que a posição atual reduz vendas; o efeito precisa ser acompanhado." },
                    { title: "Uma foto para melhorar", description: "Exemplo: um produto procurado tem uma foto pouco nítida. A proposta prepara a geração de uma prévia. Você revisa o resultado e aprova a publicação separadamente." },
                ]} />
                <BlogCallout title="Exemplos de funcionamento, não resultados prometidos">
                    Esses cenários ilustram o que a análise pode encontrar. O seu relatório deve
                    usar seus produtos e seus dados. Não há obrigação de sugerir bebidas, combos ou
                    fotos se isso não estiver entre as oportunidades relevantes do seu restaurante.
                </BlogCallout>
                <BlogSubheading>Algumas decisões precisam de você</BlogSubheading>
                <p>
                    Se uma taxa de entrega estiver muito diferente das outras, a IA pode pedir que
                    você confirme o valor. Ela não sabe, só pelo número, se aquele bairro exige uma
                    viagem especial. Esses casos ficam nos pontos para revisão: a evidência ajuda,
                    mas a decisão depende de informação da operação.
                </p>
            </BlogSection>

            <BlogSection id="estimativa" title="O potencial em reais precisa de uma conta que você possa entender">
                <p>
                    Quando há base suficiente, a análise apresenta uma faixa de receita adicional
                    estimada para as próximas quatro semanas e explica como chegou à conta.
                    As hipóteses devem estar visíveis: quantos pedidos poderiam ser afetados, qual
                    valor seria acrescentado e qual adesão foi suposta.
                </p>
                <BlogCallout title="Uma conta ilustrativa" variant="tip">
                    Imagine 100 pedidos elegíveis para uma bebida de R$ 6,00. Se 10% a 20% desses
                    pedidos acrescentarem a bebida, o cenário representa R$ 60,00 a R$ 120,00 de
                    receita adicional. A quantidade e o preço são dados; a adesão é uma hipótese.
                </BlogCallout>
                <p>
                    Uma descrição mais clara, uma foto melhor ou um kit configurado corretamente
                    podem ser úteis sem ter um ganho calculável. <strong>O valor no topo pode cobrir
                    apenas parte das oportunidades.</strong> Não é correto aumentar a projeção só
                    porque o relatório encontrou mais coisas para corrigir.
                </p>
                <p>
                    Receita também não é lucro: bebida, embalagem e operação têm custos.
                    Leia as hipóteses, veja quais mudanças entraram na conta e use a estimativa para
                    comparar cenários, sem tratá-la como garantia de resultado.
                </p>
            </BlogSection>

            <BlogSection id="comparacoes" title="Restaurantes parecidos ajudam a fazer perguntas melhores">
                <p>
                    Quando há um grupo adequado e dados suficientes, o relatório mostra indicadores
                    de restaurantes parecidos no iMenu. Ticket médio, pedidos com bebida ou combo,
                    itens por pedido e recompra ajudam a identificar diferenças que merecem investigação.
                </p>
                <p>
                    Um grupo vender mais bebidas não prova que você deveria copiar o cardápio dele.
                    Público, preços e tipo de atendimento podem mudar o resultado. A comparação deve
                    apoiar uma recomendação específica para sua loja, com base nas ofertas que você tem.
                    Os números privados são apresentados em conjunto, sem atribuí-los a um concorrente identificado.
                </p>
                <p>
                    Quando disponíveis, a análise também considera informações de tráfego e o
                    histórico das ações. Comparar períodos depois de uma mudança pode ajudar a
                    acompanhar o desempenho, mas uma melhora observada não prova, sozinha, que a
                    proposta causou o resultado. Promoções, sazonalidade e movimento também influenciam.
                </p>
            </BlogSection>

            <BlogSection id="aplicacao" title="Revisar e aplicar: a análise continua dentro da operação">
                <BlogSteps items={[
                    { title: "Abra a análise", description: "Veja o resumo e comece pelas prioridades do relatório disponível no Vendas IA." },
                    { title: "Entenda a recomendação", description: "Abra as evidências. Com IA Plus, você também pode conversar com o Assistente sobre aquela oportunidade e pedir ajustes." },
                    { title: "Confira a proposta", description: "Revise produtos, campos, preços e regras. Descarte o que não faz sentido para sua operação." },
                    { title: "Aprove a aplicação", description: "Com IA Plus, aplique uma proposta ou revise o conjunto pelo botão Revisar e aplicar tudo. O iMenu executa as mudanças aprovadas e informa o resultado." },
                ]} />
                <p>
                    Uma proposta preparada não altera sua loja. Se um produto tiver mudado desde a
                    análise, pode ser necessário atualizar a proposta antes de aplicar.
                    Para imagens, a geração prepara uma prévia e a publicação exige sua aprovação.
                </p>
                <p>
                    Você também pode iniciar uma tarefa pela conversa, sem partir de um relatório.
                    Veja os exemplos no guia do <Link href="/blog/assistente-ia-para-restaurante" className="font-semibold text-brand hover:underline">Assistente IA para restaurantes</Link>.
                </p>
            </BlogSection>

            <BlogSection id="acesso" title="Análise gratuita, com mais acesso e execução no IA Plus">
                <p>
                    A aba <strong>Vendas IA é gratuita</strong>. Atualmente, as análises gratuitas
                    são liberadas para alguns restaurantes por vez. Quando a sua for selecionada,
                    o relatório aparecerá na aba, com a visualização disponível no acesso gratuito.
                </p>
                <p>
                    O <strong>iMenu IA Plus</strong> libera acesso completo às oportunidades,
                    conversa sobre a análise e aplicação automática das propostas após aprovação.
                    Também permite acessar a análise sem depender da seleção gratuita — a vantagem
                    de acesso mais rápido não significa que todo relatório ficará pronto instantaneamente.
                </p>
                <p>
                    Acesse <Link href="/painel/vendas-ia" className="font-semibold text-brand hover:underline">Vendas IA no painel</Link> para
                    conferir seu estado atual. Se ainda não houver relatório, a própria página
                    explica a liberação. Para condições de capacidade, consulte os <Link href="/restaurante/dados/termos/ia-plus" className="font-semibold text-brand hover:underline">termos do IA Plus</Link>.
                </p>
                <BlogCallout title="Escolha uma melhoria que você consegue colocar em prática" variant="tip">
                    Comece por uma oportunidade com evidência clara e compatível com sua operação.
                    Revise, aprove e acompanhe os pedidos seguintes. O valor do Vendas IA aparece
                    quando uma recomendação útil se transforma em uma mudança real no restaurante.
                </BlogCallout>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faComments } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, { BlogCallout, BlogChecklist, BlogSection, BlogSteps, BlogSubheading } from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("automacao-marketing-whatsapp-restaurantes")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "Marketing automático no WhatsApp" },
    { id: "tres-automacoes", label: "Três automações do iMenu" },
    { id: "carrinho", label: "Recuperação de carrinho" },
    { id: "reativacao", label: "Reativação de clientes" },
    { id: "habitos", label: "Hábitos de compra" },
    { id: "configurar", label: "Configurar a aba Marketing" },
    { id: "mensagens", label: "Exemplos de mensagens" },
    { id: "ofertas", label: "Cupons e promoções" },
    { id: "boas-praticas", label: "Consentimento e segurança" },
    { id: "historico", label: "Histórico e resultados" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    { question: "Como automatizar o marketing pelo WhatsApp de um restaurante?", answer: "No iMenu Plus, abra Marketing, conecte o WhatsApp, habilite uma automação, personalize a mensagem e acompanhe o histórico. Os envios dependem de consentimento e elegibilidade." },
    { question: "O iMenu manda mensagens automáticas para todos os clientes?", answer: "Não. As automações consideram comportamento, consentimento, conexão, disponibilidade e regras de frequência." },
    { question: "Quando o iMenu recupera um carrinho abandonado?", answer: "O carrinho precisa estar sem movimentação por pelo menos 30 minutos, válido, com produtos e consentimento; um pedido posterior pode impedir o envio." },
    { question: "Como funciona o envio por hábitos de compra?", answer: "O iMenu identifica padrões no mesmo dia da semana e horário em pelo menos três semanas, e pode lembrar o cliente cerca de duas horas antes, se ele for elegível." },
    { question: "Preciso oferecer desconto em todas as mensagens?", answer: "Não. Promoção ou cupom são opcionais e devem estar ativos e disponíveis se selecionados." },
    { question: "As automações de Marketing são gratuitas?", answer: "Não. Recuperação de carrinho, reativação e hábitos fazem parte do iMenu Plus. CRM e Robô WhatsApp básico continuam gratuitos." },
    { question: "Como saber se uma mensagem foi enviada?", answer: "O histórico da aba Marketing mostra data, cliente, tipo de automação, oferta e status de envio." },
    { question: "O cliente pode parar de receber marketing?", answer: "Sim. A pessoa pode responder SAIR, e o restaurante deve respeitar a decisão de não receber ofertas." },
];

export default function AutomacaoMarketingWhatsAppRestaurantesPage() {
    return (
        <BlogArticle
            article={article}
            icon={faComments}
            takeaways={[
                "Quando usar recuperação de carrinho, reativação ou hábitos de compra",
                "Como configurar as mensagens e selecionar ofertas opcionais no iMenu",
                "Como acompanhar envios e respeitar o consentimento do cliente",
                "Como avaliar campanhas sem confundir mensagens enviadas com vendas",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["crm-para-restaurantes", "imenu-plus", "promocoes-para-delivery"]}
            ctaTitle="Configure o marketing automático do seu restaurante no iMenu"
        >
            <BlogSection id="o-que-e" title="Marketing automático pelo WhatsApp: mais relevância, menos mensagens manuais">
                <p>Uma pessoa colocou produtos no carrinho e saiu sem concluir. Outra comprava toda semana e parou. Uma terceira costuma pedir uma pizza na sexta-feira à noite. Para o restaurante, são oportunidades diferentes. A <strong>automação de marketing pelo WhatsApp para restaurantes</strong> usa esses sinais para ajudar a enviar mensagens no momento apropriado, sem escrever cada lembrete manualmente.</p>                <p>Na aba <Link href="/painel/marketing" className="font-semibold text-brand underline">Marketing do iMenu</Link>, você configura <strong>Hábitos de compra</strong>, <strong>Reativação de clientes</strong> e <strong>Recuperação de carrinho</strong>. Cada automação tem mensagem própria, pode receber uma oferta opcional e tem registros de envio para acompanhamento.</p>                <BlogCallout title="Marketing não é o mesmo que atendimento" variant="info">O <Link href="/painel/robo-whatsapp" className="font-semibold text-brand underline">Robô WhatsApp</Link> gratuito é voltado ao atendimento e aos pedidos. As campanhas automáticas da aba Marketing fazem parte do <Link href="/blog/imenu-plus" className="font-semibold text-brand underline">iMenu Plus</Link>. O telefone fornecido em um pedido não equivale, por si só, a consentimento para ofertas.</BlogCallout>
            </BlogSection>

            <BlogSection id="tres-automacoes" title="Três automações de marketing WhatsApp para restaurantes: qual usar?">
                <p>O objetivo não é mandar a mesma oferta para toda a base de contatos. Cada automação resolve um tipo de oportunidade: recuperar o interesse recente, convidar quem não compra há algum tempo ou lembrar um hábito identificado no histórico.</p>                <BlogChecklist items={[
                    <span key="item-0"><strong>Hábitos de compra:</strong> clientes com dias e horários recorrentes podem receber um lembrete antes do período habitual.</span>,
                    <span key="item-1"><strong>Reativação:</strong> convida clientes que ficaram um período sem fazer pedidos.</span>,
                    <span key="item-2"><strong>Recuperação de carrinho:</strong> considera checkouts iniciados e não concluídos.</span>,
                    <span key="item-3"><strong>Controle individual:</strong> cada cartão tem ativação, texto editável e promoção ou cupom opcional.</span>,
                ]} />                <p>As três seguem regras de elegibilidade e frequência. Você pode habilitar apenas as que fazem sentido para o seu tipo de operação. O sistema também verifica a disponibilidade do WhatsApp, o consentimento e as restrições de envio.</p>
            </BlogSection>

            <BlogSection id="carrinho" title="Recuperação de carrinho abandonado: como funciona a mensagem automática?">
                <p>Imagine que o cliente adicionou um hambúrguer e uma bebida, mas não finalizou. O iMenu pode considerar o carrinho depois de <strong>pelo menos 30 minutos sem movimentação</strong>, desde que o checkout continue válido, tenha produtos e o cliente tenha autorizado mensagens promocionais.</p>                <p>Quando há imagem disponível, a automação pode incluir <strong>a foto do item de maior preço do carrinho</strong>. Ela não deve insistir se o cliente já fez um pedido posteriormente ou se o carrinho deixou de ser elegível.</p>                <BlogSubheading>Exemplo de mensagem para recuperar carrinho</BlogSubheading>                <p>“Oi, Ana! Você deixou seus favoritos no carrinho da nossa hamburgueria. Se ainda quiser, é só voltar ao cardápio.” A mensagem relembra uma escolha, sem afirmar que já houve compra e sem prometer um desconto que não existe.</p>                <BlogCallout title="Carrinho abandonado não é necessariamente venda perdida" variant="tip">A pessoa pode estar comparando opções, verificando entrega ou simplesmente ter mudado de ideia. Uma abordagem breve pode ajudar, mas não substitui corrigir problemas no checkout ou no cardápio.</BlogCallout>
            </BlogSection>

            <BlogSection id="reativacao" title="Reativação de clientes inativos pelo WhatsApp: como convidá-los de volta?">
                <p>A reativação considera o histórico de pedidos e identifica clientes que não compram há certo período. A configuração atual usa <strong>30 dias sem novos pedidos</strong> como referência padrão, além de exigir consentimento e demais condições de elegibilidade.</p>                <p>Uma mensagem possível seria: “Oi, Bruno! Faz tempo que não recebemos seu pedido. Temos novidades no cardápio. Quer conferir?”. Se a loja tiver uma campanha válida, também pode vincular um cupom ou promoção à automação.</p>                <p>A ausência de compras não informa a causa: preço, atendimento, qualidade, férias ou mudança de hábitos também influenciam. Evite interpretar cada mensagem enviada como cliente recuperado; acompanhe pedidos posteriores e margem das ofertas.</p>
            </BlogSection>

            <BlogSection id="habitos" title="Hábitos de compra: envie um lembrete antes do horário que o cliente costuma pedir">
                <p>Há clientes que pedem marmita no almoço e outros que encomendam pizza no mesmo dia da semana. Quando há histórico suficiente, o sistema identifica pedidos no <strong>mesmo dia da semana e horário em pelo menos três semanas</strong>, considerando o histórico recente.</p>                <p>Se o cliente for elegível, a automação pode preparar um lembrete <strong>cerca de duas horas antes</strong> desse horário. Isso não significa prever com certeza a próxima compra: significa aproveitar um sinal de recorrência sem mandar mensagens a qualquer momento.</p>                <p>Exemplo: “Oi, Carla! A hora em que você costuma pedir está chegando. Já escolheu o que vai comer hoje?”. A mensagem pode funcionar sem desconto; se houver oferta, confira a disponibilidade e a validade dela.</p>                <BlogCallout title="Mais disparos não significam mais resultado" variant="tip">Escolha contatos relevantes, respeite o consentimento e evite insistir. Uma campanha que incomoda clientes pode prejudicar a confiança no restaurante.</BlogCallout>
            </BlogSection>

            <BlogSection id="configurar" title="Como configurar automações na aba Marketing do iMenu: passo a passo">
                <p>A configuração fica em <Link href="/painel/marketing" className="font-semibold text-brand underline">Automações de Marketing WhatsApp</Link>. Para salvar e ativar as campanhas, o restaurante precisa de iMenu Plus. O WhatsApp deve estar conectado para realizar envios. Sem conexão, é possível preparar as mensagens, mas não haverá envio.</p>                <BlogSteps items={[
                    { title: "Abra Marketing no painel", description: "Entre na aba Marketing e verifique o acesso ao iMenu Plus." },
                    { title: "Confira a conexão do WhatsApp", description: "Abra Robô WhatsApp para conectar o número da loja, se necessário." },
                    { title: "Escolha a automação", description: "Hábitos de compra, Reativação e Recuperação de carrinho podem ser habilitadas separadamente." },
                    { title: "Edite o texto", description: "Personalize a mensagem. Use Adicionar variável para inserir nome do cliente ou do restaurante, ou Restaurar mensagem padrão." },
                    { title: "Selecione uma oferta opcional", description: "Em Promoção ou cupom (opcional), escolha uma opção ativa ou deixe Sem oferta anexada." },
                    { title: "Confira o salvamento", description: "As alterações são salvas automaticamente; observe o indicador de salvamento da página." },
                    { title: "Acompanhe os resultados operacionais", description: "Consulte o histórico de envios na própria aba Marketing." },
                ]} />                <p>As automações compartilham um controle de volume diário de mensagens. Aumentá-lo sem critério pode elevar o risco de restrições no WhatsApp. Configure uma campanha com objetivo claro antes de ampliar a frequência.</p>
            </BlogSection>

            <BlogSection id="mensagens" title="Exemplos de mensagens de marketing para restaurantes no WhatsApp">
                <p>Uma boa mensagem é curta, apresenta um motivo verdadeiro para o contato e orienta o cliente a uma ação simples. Evite pressão, urgência fictícia e ofertas sem validade.</p>                <BlogChecklist items={[
                    <span key="item-0"><strong>Carrinho:</strong> “Oi! Seu carrinho ainda tem produtos selecionados. Se quiser, volte ao nosso cardápio para concluir.”</span>,
                    <span key="item-1"><strong>Reativação:</strong> “Olá! Faz um tempo que você não pede com a gente. Quer conhecer as novidades desta semana?”</span>,
                    <span key="item-2"><strong>Hábitos:</strong> “Sua hora favorita de pedir está chegando. Já deu uma olhada no cardápio?”</span>,
                    <span key="item-3"><strong>Com promoção:</strong> “Temos uma oferta disponível para seu próximo pedido. Confira as condições no cardápio.”</span>,
                ]} />                <p>O editor da aba Marketing permite personalizar cada texto e inserir variáveis de <strong>nome do cliente</strong> e <strong>nome do restaurante</strong>. O iMenu usa os dados disponíveis durante o envio; não é necessário escrever um texto individual por pessoa.</p>                <BlogSubheading>O que evitar na personalização?</BlogSubheading>                <p>Não diga “seu pedido está pronto” em um lembrete de carrinho. Não sugira que a IA conhece preferências íntimas do cliente. Não prometa desconto sem conferir se está ativo. Uma mensagem comercial deve descrever algo que o restaurante pode cumprir.</p>
            </BlogSection>

            <BlogSection id="ofertas" title="Marketing automático com ou sem cupom: como escolher uma boa oferta?">
                <p>O campo <strong>Promoção ou cupom (opcional)</strong> permite associar ofertas válidas que já foram configuradas no restaurante. Caso uma oferta esteja indisponível, selecione outra ou retire a associação. Para criar e organizar campanhas, use <Link href="/painel/promocoes" className="font-semibold text-brand underline">Promoções no iMenu</Link>.</p>                <p>Não é necessário distribuir desconto para ativar a automação. Um lembrete oportuno pode ter valor por si só; um cupom pode ajudar em uma reativação específica, mas também reduzir a margem. A decisão depende dos custos, do público e das condições do pedido.</p>                <BlogCallout title="Exemplo de margem" variant="tip">Dez pedidos com R$ 8 de desconto representam R$ 80 em descontos concedidos. Verifique o custo dos produtos e o resultado líquido, não apenas quantas pessoas receberam a mensagem.</BlogCallout>
            </BlogSection>

            <BlogSection id="boas-praticas" title="Consentimento e boas práticas no marketing WhatsApp de restaurantes">
                <p>As mensagens promocionais são voltadas a clientes que <strong>autorizaram receber ofertas</strong> e continuam elegíveis. O iMenu aplica regras de espera por automação, evita múltiplos contatos automáticos para a mesma pessoa em um intervalo de 24 horas e respeita a opção de parar de receber campanhas.</p>                <p>O destinatário pode responder <strong>SAIR</strong> para cancelar mensagens promocionais futuras. O restaurante também deve respeitar solicitações de descadastro e não presumir autorização apenas porque alguém cadastrou o número no checkout.</p>                <BlogChecklist items={[
                    <span key="item-0"><strong>Consentimento:</strong> confirme a permissão para receber comunicações comerciais.</span>,
                    <span key="item-1"><strong>Frequência:</strong> não transforme uma campanha em uma sequência insistente de mensagens.</span>,
                    <span key="item-2"><strong>Relevância:</strong> mantenha textos e ofertas compatíveis com o cardápio real.</span>,
                    <span key="item-3"><strong>Conexão:</strong> confirme a disponibilidade do número no Robô WhatsApp.</span>,
                    <span key="item-4"><strong>Descadastro:</strong> respeite o pedido de saída do cliente.</span>,
                    <span key="item-5"><strong>Resultado:</strong> envio registrado não é prova de leitura, pedido ou venda.</span>,
                ]} />
            </BlogSection>

            <BlogSection id="historico" title="Histórico de envios: como acompanhar campanhas e avaliar resultados">
                <p>A própria aba Marketing traz um <strong>histórico de automações</strong>, com data e hora, cliente, modalidade, oferta associada e status, como Enviado ou Falhou. Esses registros ajudam a identificar falhas operacionais e verificar quais mensagens foram processadas.</p>                <p>O histórico de envios não deve ser confundido com uma medição de vendas atribuídas. Para analisar impacto, compare períodos equivalentes, pedidos posteriores, frequência de recompra e margem dos incentivos. Sazonalidade, clima e outras campanhas também podem afetar os números.</p>                <BlogSteps items={[
                    { title: "Escolha um único objetivo", description: "Por exemplo, reduzir carrinhos interrompidos ou incentivar o retorno de clientes inativos." },
                    { title: "Observe o cenário anterior", description: "Anote frequência de pedidos, ticket médio e promoções vigentes." },
                    { title: "Configure uma automação", description: "Habilite uma campanha com texto claro e oferta adequada, se necessário." },
                    { title: "Confira a execução", description: "Use a tabela da aba Marketing para acompanhar envios e falhas." },
                    { title: "Compare e ajuste", description: "Analise compras e margem em períodos parecidos; revise ou desative a campanha se não ajudar." },
                ]} />                <p>Para entender melhor a base de clientes, leia o <Link href="/blog/crm-para-restaurantes" className="font-semibold text-brand underline">guia de CRM para restaurantes</Link>. Se quiser conhecer os demais benefícios pagos, veja o <Link href="/blog/imenu-plus" className="font-semibold text-brand underline">guia do iMenu Plus</Link>. Para começar, abra <Link href="/painel/marketing" className="font-semibold text-brand underline">a aba Marketing</Link>.</p>
            </BlogSection>
        </BlogArticle>
    );
}

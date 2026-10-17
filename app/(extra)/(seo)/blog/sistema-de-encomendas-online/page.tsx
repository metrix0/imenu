import Link from "next/link";
import { faCalendarCheck } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("sistema-de-encomendas-online")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "por-que", label: "Por que organizar encomendas" },
    { id: "como-funciona", label: "Como funciona online" },
    { id: "para-quem", label: "Quem pode usar" },
    { id: "configurar", label: "Como ativar no iMenu" },
    { id: "antecedencia", label: "Dias e horários" },
    { id: "exemplo", label: "Exemplo na prática" },
    { id: "divulgar", label: "Como conseguir encomendas" },
    { id: "erros", label: "Erros comuns" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como receber encomendas online?",
        answer: "Crie um cardápio digital com seus produtos, habilite o Modo Encomendas, configure os horários disponíveis e a antecedência mínima. O cliente acessa o link, escolhe os itens e agenda obrigatoriamente o dia e o horário antes de concluir o pedido.",
    },
    {
        question: "Existe sistema de encomendas online grátis?",
        answer: "Sim. O cardápio digital do iMenu é gratuito, e o Modo Encomendas permite receber pedidos agendados sem exigir uma mensalidade pelo recurso. Serviços opcionais, como Pix Online, podem ter condições próprias.",
    },
    {
        question: "Posso vender bolos e doces por encomenda com dia e hora marcados?",
        answer: "Sim. O Modo Encomendas do iMenu usa o agendamento de pedidos: os clientes escolhem uma data futura e um horário disponível que você definiu para entrega ou retirada.",
    },
    {
        question: "É possível exigir antecedência mínima para encomendas?",
        answer: "Sim. Em Horários, o campo Dias até encomenda permite configurar de 0 a 59 dias de antecedência. Por exemplo, ao definir 2 dias, o cliente não pode agendar a encomenda para hoje nem para amanhã.",
    },
    {
        question: "Posso ter horários diferentes para encomendas e funcionamento normal?",
        answer: "Sim. O iMenu preserva os horários normais da loja e permite configurar uma grade semanal separada para os horários disponíveis de encomendas.",
    },
    {
        question: "O cliente pode comprar sem escolher o horário?",
        answer: "Não quando o Modo Encomendas está ativo. A seleção de dia e horário é obrigatória e o sistema valida se a data atende à antecedência e se o horário pertence à grade configurada.",
    },
    {
        question: "Preciso ficar respondendo mensagens no WhatsApp para anotar cada pedido?",
        answer: "Você pode compartilhar o link do cardápio pelo WhatsApp, Instagram e redes sociais. O cliente preenche o pedido e o agendamento pelo próprio cardápio, reduzindo a necessidade de coletar tudo manualmente na conversa.",
    },
];

export default function SistemaDeEncomendasOnlinePage() {
    return (
        <BlogArticle
            article={article}
            icon={faCalendarCheck}
            takeaways={[
                "Como receber encomendas com data e horário definidos pelo cliente",
                "Como configurar horários exclusivos e antecedência mínima no iMenu",
                "Como usar um cardápio digital gratuito para bolos, doces, salgados e outros produtos feitos sob pedido",
                "Checklist para evitar pedidos fora do prazo e reduzir mensagens repetitivas",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-montar-cardapio-delivery",
                "como-vender-delivery-pelo-whatsapp",
                "programa-fidelidade-restaurante",
            ]}
            ctaTitle="Abra seu cardápio digital grátis e comece a receber encomendas agendadas"
        >
            <BlogSection id="por-que" title="Sistema de encomendas online: saia do caderno e das conversas espalhadas">
                <p>
                    É sexta-feira. Você está terminando um bolo de aniversário quando chega
                    outra mensagem: “Meu pedido ficou para sábado às 14h ou domingo às
                    14h?”. A confirmação está perdida entre áudios, fotos de referência e
                    mensagens de outros clientes. Quem trabalha com produtos feitos sob
                    encomenda conhece bem esse tipo de confusão.
                </p>
                <p>
                    Um <strong>sistema de encomendas online</strong> resolve o começo desse
                    problema: o cliente entra em um cardápio digital, escolhe os produtos
                    e informa <strong>o dia e o horário de entrega ou retirada</strong> antes
                    de finalizar. O restaurante define quais horários aparecem e com quantos
                    dias de antecedência aceita novos pedidos.
                </p>
                <p>
                    Isso serve tanto para uma confeitaria que recebe pedidos de bolos e
                    doces quanto para quem vende salgados para festas, marmitas preparadas
                    sob demanda, kits para eventos e produtos disponíveis apenas em dias
                    específicos. Você deixa de depender de uma conversa individual para
                    coletar as informações básicas de toda encomenda.
                </p>
                <BlogCallout title="Encomenda não é a mesma coisa que delivery imediato" variant="tip">
                    No delivery tradicional, o cliente costuma comprar para receber em
                    seguida. Na encomenda, a produção ou a separação depende de um prazo,
                    e a entrega ou retirada precisa ser combinada com antecedência.
                    Por isso, <strong>agendar o pedido é parte essencial da compra</strong>.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-funciona" title="Como funciona um cardápio digital para encomendas">
                <p>
                    A experiência deve ser simples para o consumidor e previsível para
                    quem produz. No <strong>Modo Encomendas do iMenu</strong>, o cliente
                    usa o mesmo fluxo de agendamento já existente no cardápio: seleciona
                    um dia permitido, escolhe um horário disponível e conclui o pedido.
                    A diferença é que, nesse modo, <strong>agendar é obrigatório</strong>.
                </p>
                <BlogSteps items={[
                    {
                        title: "O cliente abre seu cardápio pelo link",
                        description: "Envie o endereço no WhatsApp, na bio do Instagram ou pelo QR Code. As pessoas consultam produtos, preços e opções no próprio celular.",
                    },
                    {
                        title: "Escolhe os produtos e os complementos",
                        description: "Monte categorias claras para bolos, caixas de doces, kits e outros itens. Descreva tamanhos, porções e o que está incluído para evitar dúvidas.",
                    },
                    {
                        title: "Agenda dia e horário",
                        description: "O checkout mostra as datas e os horários permitidos. Não é possível concluir uma encomenda sem a seleção obrigatória do agendamento.",
                    },
                    {
                        title: "O pedido chega organizado",
                        description: "Os dados do pedido seguem para o fluxo normal de pedidos do iMenu, com o horário agendado. Você acompanha as encomendas sem precisar conferir datas em várias conversas.",
                    },
                ]} />
                <p>
                    Para entender outras formas de vender diretamente pelo seu próprio
                    link, veja também nosso guia de{" "}
                    <Link href="/blog/como-vender-delivery-pelo-whatsapp" className="font-semibold text-brand underline">
                        como vender delivery pelo WhatsApp
                    </Link>. O aplicativo de mensagens continua sendo um ótimo canal de
                    divulgação e relacionamento; o cardápio organiza a compra.
                </p>
            </BlogSection>

            <BlogSection id="para-quem" title="Sistema de encomendas para confeitaria, doceria, salgados e mais">
                <BlogSubheading>Bolos de aniversário e confeitaria artesanal</BlogSubheading>
                <p>
                    Bolos decorados, tortas e doces personalizados demandam tempo de
                    preparo. Divulgue os modelos disponíveis e defina o prazo necessário
                    para produzir com tranquilidade. Um bolo para o fim de semana não
                    precisa disputar a mesma janela de um produto à pronta entrega.
                </p>
                <BlogSubheading>Doces para festas e caixas de presente</BlogSubheading>
                <p>
                    Brigadeiros, brownies, cupcakes e caixas comemorativas costumam ser
                    vendidos em quantidades e datas específicas. Organize os produtos por
                    categoria e use as descrições para informar peso, número de unidades,
                    sabores e detalhes relevantes. O cliente já escolhe o horário em que
                    pretende retirar ou receber.
                </p>
                <BlogSubheading>Salgados, kits para eventos e refeições sob pedido</BlogSubheading>
                <p>
                    Coxinhas por cento, mini-sanduíches, tábuas, kits de café da manhã e
                    refeições preparadas para datas combinadas também se beneficiam de
                    agendamento. A grade de horários ajuda a oferecer retiradas nos
                    períodos em que sua equipe consegue atender.
                </p>
                <BlogCallout title="Nem tudo precisa ser feito apenas sob encomenda" variant="info">
                    O iMenu também oferece agendamento de pedidos para restaurantes
                    convencionais. O <strong>Modo Encomendas</strong> é a escolha para
                    negócios que precisam tornar o agendamento obrigatório e usar uma
                    grade própria de horários.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="configurar" title="Como ativar o Modo Encomendas no iMenu: passo a passo">
                <p>
                    Você não precisa criar um segundo cardápio nem procurar um sistema
                    separado para aceitar pedidos futuros. O modo fica na própria tela
                    de <strong>Horários</strong> do iMenu, inclusive durante o cadastro
                    do restaurante.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra Horários de Funcionamento",
                        description: <>No painel do iMenu, acesse <Link href="/painel/disponibilidade" className="font-semibold text-brand underline">Horários</Link>. Na parte superior, clique em “Trabalha só com encomendas? Clique aqui”.</>,
                    },
                    {
                        title: "Confirme a ativação",
                        description: "Leia a confirmação e ative “Trabalho apenas com encomendas”. O sistema habilita automaticamente o agendamento para Dias futuros e mantém salvos os horários normais da loja.",
                    },
                    {
                        title: "Configure os horários das encomendas",
                        description: "Na seção “Horários em que encomendas são feitas”, escolha os dias e intervalos semanais permitidos para retirada ou entrega. A grade é separada dos horários normais de funcionamento.",
                    },
                    {
                        title: "Defina os Dias até encomenda",
                        description: "Informe quantos dias de antecedência são necessários para preparar um pedido. A configuração aceita de 0 a 59 dias; zero permite agendamentos para o próprio dia, respeitando os horários disponíveis.",
                    },
                    {
                        title: "Faça um pedido de teste",
                        description: "Abra o cardápio público, escolha um item e confira se o checkout exige data e horário e se datas fora do prazo não aparecem.",
                    },
                ]} />
                <p>
                    Os horários antigos não são apagados quando o modo é ligado. Assim,
                    se mais tarde você voltar à operação convencional, não precisa
                    reconstruir a semana de funcionamento do zero.
                </p>
                <BlogCallout title="O que muda nas configurações de agendamento?" variant="tip">
                    A opção <strong>Dias futuros</strong> é ativada automaticamente
                    enquanto o Modo Encomendas estiver ativo. O cliente não pode pular
                    a escolha do dia e do horário no checkout.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="antecedencia" title="Antecedência mínima e horários: duas configurações que trabalham juntas">
                <p>
                    Há uma diferença importante entre <strong>quando o cliente faz a
                    encomenda</strong> e <strong>quando você entrega ou disponibiliza
                    o produto</strong>. O link do cardápio permite registrar o pedido;
                    a grade de horários define os momentos disponíveis para o agendamento
                    de entrega ou retirada.
                </p>
                <BlogSubheading>Exemplo de antecedência: 2 dias</BlogSubheading>
                <p>
                    Imagine que sua produção exige dois dias de preparação. Se o cliente
                    entrar no cardápio na segunda-feira, as primeiras datas possíveis
                    serão a partir de quarta-feira. A plataforma só oferecerá horários
                    que você cadastrou para as datas permitidas. Se quarta estiver
                    sem horários, o cliente terá de escolher outro dia disponível.
                </p>
                <BlogSubheading>Exemplo de horários: retiradas aos sábados</BlogSubheading>
                <p>
                    Uma confeitaria pode produzir durante a semana e liberar retiradas
                    apenas aos sábados, das 9h às 12h. Na grade semanal de encomendas,
                    deixe esse intervalo ativo no sábado e feche os dias em que não
                    deseja oferecer agendamento. Isso evita prometer uma retirada
                    para uma terça-feira em que a operação não atende.
                </p>
                <BlogSubheading>Quanto tempo de antecedência escolher?</BlogSubheading>
                <p>
                    O prazo depende do seu processo. Para itens simples e insumos já
                    disponíveis, a antecedência pode ser curta. Para encomendas grandes
                    ou decoração personalizada, reserve mais dias para compras,
                    produção, acabamento e transporte. Considere também fins de semana,
                    feriados e a quantidade de pedidos que sua equipe suporta.
                </p>
                <p>
                    No iMenu, esse prazo é configurado em <strong>dias de calendário</strong>,
                    não em horas individuais, e a seleção de datas futuras no checkout
                    trabalha com uma janela de até 60 dias.
                </p>
            </BlogSection>

            <BlogSection id="exemplo" title="Exemplo realista: uma confeitaria que vende bolos por encomenda">
                <p>
                    Suponha uma confeitaria com três linhas de produtos: bolos inteiros,
                    caixas de 24 docinhos e kits de aniversário. Ela não mantém esses
                    produtos prontos o dia todo. Antes, o cliente mandava uma mensagem
                    perguntando preço e precisava negociar a data separadamente.
                </p>
                <p>
                    Ao configurar um <strong>cardápio digital para encomendas</strong>,
                    a equipe coloca os itens e tamanhos no menu, ativa o modo, define
                    dois dias mínimos de antecedência e habilita retiradas de sexta e
                    sábado entre 10h e 17h. Agora, quem entra pelo link vê os itens e
                    precisa selecionar uma combinação válida de dia e horário.
                </p>
                <p>
                    A vantagem não é vender uma quantidade milagrosa de bolos.
                    É <strong>reduzir retrabalho na coleta de informações</strong>,
                    deixar mais explícitas as condições de atendimento e ganhar
                    previsibilidade para organizar ingredientes, embalagens e entregas.
                </p>
                <BlogCallout title="Uma agenda de horários não substitui o planejamento da capacidade" variant="warning">
                    A configuração de horários e antecedência ajuda a controlar quando
                    o cliente pode agendar. Ela não equivale, por si só, a um limite
                    automático de encomendas por dia. Se sua produção tem capacidade
                    restrita, acompanhe os pedidos recebidos e ajuste a disponibilidade
                    de acordo com a operação.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="divulgar" title="Como conseguir mais encomendas usando o cardápio digital">
                <BlogSubheading>Coloque o link onde os clientes já estão</BlogSubheading>
                <p>
                    Fixe o endereço do cardápio na bio do Instagram, no perfil comercial
                    do WhatsApp, nas redes sociais e nos materiais impressos. Mensagens
                    como “Encomende seu bolo para sábado: escolha o sabor e agende a
                    retirada no link” são mais claras do que “chame no direct”.
                </p>
                <BlogSubheading>Use fotos, porções e descrições específicas</BlogSubheading>
                <p>
                    Quem compra um bolo para 20 pessoas quer saber o tamanho, os sabores
                    possíveis, o rendimento e o que acompanha. Quem pede 100 salgados
                    precisa entender se pode combinar sabores e quantas unidades vêm
                    por embalagem. Bons títulos e descrições evitam perguntas repetidas
                    e ajudam na escolha.
                </p>
                <BlogSubheading>Divulgue datas sazonais com antecedência</BlogSubheading>
                <p>
                    Datas como Dia das Mães, Páscoa, Natal e festas de fim de ano costumam
                    exigir planejamento. Publique o cardápio e explique quando encerram
                    os pedidos. Ajuste a antecedência mínima conforme o calendário
                    de produção, em vez de depender da memória de quem responde mensagens.
                </p>
                <p>
                    Para montar um menu mais claro antes de começar, consulte nosso guia{" "}
                    <Link href="/blog/como-montar-cardapio-delivery" className="font-semibold text-brand underline">
                        como montar um cardápio de delivery
                    </Link>. Mesmo quando você só atende por encomendas, organização,
                    fotos e preços continuam influenciando a decisão de compra.
                </p>
            </BlogSection>

            <BlogSection id="erros" title="Checklist: o que conferir antes de abrir seu sistema de encomendas">
                <BlogChecklist items={[
                    "Modo Encomendas ativado na página Horários",
                    "Agendamento para Dias futuros habilitado automaticamente",
                    "Horários de retirada ou entrega revisados em todos os dias da semana",
                    "Antecedência mínima compatível com a produção",
                    "Produtos com nomes, tamanhos, preços e descrições completos",
                    "Teste de agendamento para um dia permitido",
                    "Teste de data anterior à antecedência mínima",
                    "Teste de dia ou horário sem disponibilidade",
                    "Confirmação de que o checkout exige dia e horário",
                    "Link do cardápio colocado nas redes sociais e no WhatsApp",
                ]} />
                <p>
                    Um sistema de encomendas é tão útil quanto as regras que você
                    configura. Revise os horários quando mudar sua rotina, planeje
                    períodos de alta demanda e mantenha o cardápio atualizado.
                    Assim, o cliente entende quando pode receber, e você reduz
                    o risco de assumir compromissos incompatíveis com a produção.
                </p>
                <p>
                    Se você quer começar sem mensalidade para o cardápio, conheça o{" "}
                    <Link href="/cardapio-digital-gratuito" className="font-semibold text-brand underline">
                        cardápio digital gratuito do iMenu
                    </Link>. Cadastre seus produtos, compartilhe o link e, se trabalha
                    exclusivamente sob pedido, ative o Modo Encomendas em Horários.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("assistente-ia-para-restaurante")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "do-pedido-a-mudanca", label: "Da conversa ao cardápio atualizado" },
    { id: "o-que-faz", label: "O que você pode pedir" },
    { id: "comandos", label: "Comandos para usar hoje" },
    { id: "imagens", label: "Imagens com aprovação" },
    { id: "controle", label: "Você decide o que entra no ar" },
    { id: "acesso", label: "Como começar grátis" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    { question: "O Assistente IA do iMenu é gratuito?", answer: "Sim. Você pode conversar e gerar imagens dentro da capacidade gratuita. O iMenu IA Plus é opcional e oferece limites maiores. Atingir o limite da IA não impede o uso normal do cardápio e do painel." },
    { question: "A IA altera meu cardápio sozinha?", answer: "Ela prepara propostas. Depois que você revisa e clica em Aplicar, o sistema executa as alterações aprovadas no restaurante. Uma mensagem enviada no chat não é uma aprovação para publicar mudanças." },
    { question: "Preciso copiar a resposta da IA para cada produto?", answer: "Quando o pedido vira uma proposta executável, não. O cartão mostra as mudanças e o iMenu as aplica após sua confirmação, sem exigir que você copie cada descrição ou preço à mão." },
    { question: "Posso gerar imagens para produtos, logo e banner?", answer: "Sim, dentro dos limites disponíveis. A imagem é uma prévia para revisão. Gerar a imagem não a publica: a publicação depende de aprovação e o resultado deve representar corretamente seu produto ou marca." },
    { question: "Qual é a diferença para o Vendas IA?", answer: "O Assistente IA parte da sua conversa e dos seus pedidos. O Vendas IA apresenta uma análise estruturada de oportunidades com base nos dados do restaurante. Com IA Plus, você também pode discutir e aplicar as propostas da análise." },
];

export default function AssistenteIaParaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faWandMagicSparkles}
            takeaways={[
                "Como transformar uma mensagem em mudanças prontas para aprovar",
                "Comandos úteis para descrições, preços, organização e imagens",
                "Como o iMenu aplica as alterações sem você editar cada produto",
                "O que está disponível gratuitamente e como ampliar a capacidade",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["analise-de-vendas-com-ia", "criar-cardapio-com-ia", "como-montar-cardapio-delivery"]}
            ctaTitle="Peça a melhoria. Aprove a proposta. Deixe o iMenu executar."
        >
            <BlogSection id="do-pedido-a-mudanca" title="Seu próximo ajuste no cardápio pode começar com uma mensagem">
                <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0 space-y-5">
                        <p>
                            A cozinha precisa de você, o WhatsApp está chamando e ainda falta arrumar as descrições
                            dos produtos. Você sabe o que quer mudar. O trabalho é abrir cada item, encontrar o
                            campo certo, escrever, salvar e repetir. <strong>O Assistente IA do iMenu encurta esse caminho.</strong>
                        </p>
                        <p>
                            Escreva o que precisa em linguagem normal. A IA consulta os dados disponíveis do
                            restaurante e pode preparar uma proposta com os ajustes exatos. Você vê o que será
                            alterado, aprova e <strong>o sistema aplica as mudanças automaticamente no seu cardápio</strong>.
                        </p>
                    </div>
                    <figure className="w-full max-w-xs justify-self-center overflow-hidden rounded-3xl border border-orange-100 bg-orange-50/40 p-4 shadow-sm">
                        <img src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="iMenu IA Plus" width={950} height={199} className="mx-auto mb-4 h-auto w-40 max-w-full" />
                        <img src="/images/IAPlus.png" alt="Representação do Assistente IA preparando uma descrição e uma imagem de hambúrguer para aprovação" width={1602} height={1823} className="mx-auto block h-auto w-full rounded-2xl" />
                    </figure>
                </div>
                <BlogCallout title="A resposta já pode vir com a execução preparada" variant="tip">
                    Peça: “Melhore a descrição do meu hambúrguer de costela, mantendo os ingredientes”.
                    Quando houver informação suficiente, o Assistente pode apresentar a nova descrição
                    em um cartão de alteração. Você aprova ali e o produto é atualizado.
                </BlogCallout>
                <p>
                    Isso muda a rotina: uma ideia pode chegar ao cardápio dentro da própria conversa.
                    A aprovação continua sendo sua, mas o trabalho de preencher os campos fica com o iMenu.
                </p>
            </BlogSection>

            <BlogSection id="o-que-faz" title="Descrições, preços, organização: peça o ajuste que sua operação precisa">
                <p>
                    O Assistente trabalha com o cardápio e as configurações comerciais que o sistema
                    permite editar. Ele pode ajudar em uma tarefa pequena, como corrigir o nome de um
                    item, ou preparar várias alterações relacionadas para você revisar juntas.
                </p>
                <BlogChecklist items={[
                    <span key="descricao"><strong>Descrições que ajudam a escolher:</strong> esclarecer ingredientes, porções e diferenças entre produtos.</span>,
                    <span key="nomes"><strong>Nomes e escrita:</strong> corrigir erros e deixar as informações mais consistentes.</span>,
                    <span key="precos"><strong>Preços definidos por você:</strong> preparar ajustes nos itens indicados, com o valor anterior e o proposto.</span>,
                    <span key="ordem"><strong>Organização do cardápio:</strong> propor mudanças na posição de categorias e produtos.</span>,
                    <span key="adicionais"><strong>Opções e complementos:</strong> ajudar a configurar escolhas e adicionais sem você editar todos os campos manualmente.</span>,
                    <span key="imagem"><strong>Conteúdo visual:</strong> gerar prévias de imagens para produtos, logo e banner.</span>,
                ]} />
                <BlogSubheading>O contexto importa</BlogSubheading>
                <p>
                    “Melhore meu cardápio” deixa muitas decisões em aberto. “Deixe as descrições dos
                    três hambúrgueres mais vendidos mais claras, sem alterar ingredientes nem preços”
                    dá à IA um objetivo útil e um limite que faz sentido para sua operação.
                    Se faltarem dados essenciais, ela pode precisar perguntar antes de preparar a proposta.
                </p>
            </BlogSection>

            <BlogSection id="comandos" title="Cinco comandos para sair da ideia e chegar a uma alteração real">
                <p>
                    Os exemplos abaixo são pedidos que você pode adaptar ao seu restaurante.
                    Os produtos precisam existir no seu cardápio, e a proposta depende das informações
                    disponíveis. Use o nome real do item e diga o que deve ser preservado.
                </p>
                <BlogSteps items={[
                    { title: "Clareza sem inventar ingredientes", description: <><strong>“Reescreva a descrição do Burger Duplo. Deixe claro que são duas carnes de 140 g cada e preserve os ingredientes cadastrados.”</strong> Você recebe um texto para revisar e, se houver proposta, aplicar diretamente.</> },
                    { title: "Um preço que você já decidiu", description: <><strong>“Altere a Coca lata para R$ 6,50. Não mude as outras bebidas.”</strong> Confira o preço anterior e o novo no cartão antes de aprovar.</> },
                    { title: "Organização com um objetivo", description: <><strong>“Coloque a categoria Combos depois de Promoções e mantenha a ordem dos produtos dentro dela.”</strong> A IA pode preparar a mudança de posição compatível com seu cardápio.</> },
                    { title: "Escolhas mais fáceis de entender", description: <><strong>“Corrija a escrita dos grupos de adicionais dos hambúrgueres. Preserve preços e regras de escolha.”</strong> Uma proposta pode reunir correções relacionadas para evitar trabalho repetido.</> },
                    { title: "Uma foto com referência", description: <><strong>“Prepare uma prévia mais nítida para este produto usando a foto como referência. Preserve a porção e os ingredientes.”</strong> A imagem será revisada antes de qualquer publicação.</> },
                ]} />
                <BlogCallout title="Informe a decisão comercial que só você conhece">
                    Para pedir desconto, preço ou promoção, explique o valor desejado e as condições.
                    A IA não conhece um custo que você não informou. Um texto bem escrito e um preço
                    menor não são prova de que a margem vai melhorar.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="imagens" title="Da prévia à publicação: imagens também passam pela sua aprovação">
                <p>
                    Uma imagem pode tornar o produto mais fácil de reconhecer, mas precisa mostrar
                    o que o cliente realmente recebe. O Assistente permite gerar uma prévia e
                    revisar o resultado antes de colocá-lo no cardápio.
                </p>
                <p>
                    Quando houver foto de referência, peça para preservar ingredientes, tamanho e
                    apresentação. Sem uma referência suficiente, descreva o produto: quantidade,
                    embalagem, acompanhamentos e detalhes que precisam aparecer.
                    <strong> Gerar uma imagem não significa publicar a imagem.</strong>
                </p>
                <BlogChecklist items={[
                    "O produto tem os ingredientes e a porção realmente vendidos?",
                    "A embalagem e os acompanhamentos correspondem à oferta?",
                    "Textos, logo e identidade visual estão corretos?",
                    "Você aprovou a publicação da prévia escolhida?",
                ]} />
            </BlogSection>

            <BlogSection id="controle" title="O trabalho é automático. A decisão é sua.">
                <BlogSteps items={[
                    { title: "Você pede", description: "Abra o Assistente IA e explique o resultado desejado." },
                    { title: "A IA prepara", description: "Ela consulta o estado atual e apresenta a proposta quando houver uma alteração executável." },
                    { title: "Você revisa", description: "Confira quais produtos e campos serão alterados. Você pode descartar a proposta ou pedir um ajuste." },
                    { title: "O iMenu aplica", description: "Ao clicar em Aplicar, o sistema executa as mudanças aprovadas e informa o resultado." },
                ]} />
                <p>
                    Se o item mudou depois que a proposta foi criada, o sistema pode pedir uma nova
                    revisão. Algumas alterações podem ser desfeitas pelo histórico, quando o estado
                    atual permitir. Pedidos, histórico de vendas, repasses e dados pessoais protegidos
                    não fazem parte dos campos que o Assistente pode modificar.
                </p>
            </BlogSection>

            <BlogSection id="acesso" title="Comece grátis e use mais capacidade quando precisar">
                <p>
                    O <strong>Assistente IA é gratuito, com limites de conversa e geração de imagens</strong>.
                    A capacidade é medida pelo processamento da conversa, não por um número fixo de
                    mensagens: pedidos extensos e conversas longas podem consumir mais.
                    Os limites gratuitos consideram o uso dos últimos sete dias.
                </p>
                <p>
                    Atingir o limite de imagens impede novas gerações naquele período, mas você pode
                    continuar conversando se ainda houver capacidade de conversa. O iMenu IA Plus
                    oferece limites maiores e também libera a aplicação das oportunidades da Análise
                    de vendas. Essa capacidade continua sujeita aos limites informados nos termos.
                </p>
                <p>
                    Abra o <Link href="/painel/assistente-ia" className="font-semibold text-brand hover:underline">Assistente IA no painel</Link>,
                    escolha uma tarefa concreta e comece por ela. Para descobrir o que merece atenção
                    a partir das vendas, conheça o <Link href="/blog/analise-de-vendas-com-ia" className="font-semibold text-brand hover:underline">Vendas IA do iMenu</Link>.
                </p>
                <BlogCallout title="A primeira tarefa pode ser pequena" variant="tip">
                    Escolha um produto importante cuja descrição está confusa. Peça uma versão mais
                    clara, revise a proposta e aplique. Você conhece o fluxo com uma mudança útil para
                    seu restaurante.
                </BlogCallout>
            </BlogSection>
        </BlogArticle>
    );
}

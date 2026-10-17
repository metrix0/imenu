import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("criar-cardapio-com-ia")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "como-funciona", label: "Como funciona" },
    { id: "arquivos", label: "Fotos, PDFs e links" },
    { id: "passo-a-passo", label: "Passo a passo" },
    { id: "revisao", label: "O que revisar" },
    { id: "quando-usar", label: "Quando vale a pena" },
    { id: "erros", label: "Erros comuns" },
    { id: "depois", label: "Depois do scan" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Dá para criar um cardápio digital com inteligência artificial?",
        answer:
            "Sim. A IA pode analisar fotos, PDFs e links de cardápios públicos compatíveis, identificar categorias e produtos e organizar o conteúdo para revisão antes de publicar.",
    },
    {
        question: "A IA consegue ler preço e descrição do cardápio?",
        answer:
            "Ela pode detectar nome, descrição, preço e categoria quando essas informações estão acessíveis e legíveis. Revise o resultado antes de publicar.",
    },
    {
        question: "Posso tirar foto do cardápio impresso?",
        answer:
            "Sim. No iMenu é possível usar imagens, PDFs ou abrir a câmera. Fotos retas, nítidas, bem iluminadas e sem reflexo tendem a produzir resultados melhores.",
    },
    {
        question: "Quantos arquivos posso enviar no Scan com IA do iMenu?",
        answer:
            "O iMenu aceita até oito PDFs e/ou imagens por análise. Como alternativa, você pode colar o link de um cardápio público compatível.",
    },
    {
        question: "Posso importar meu cardápio pelo link?",
        answer:
            "Sim, se a página for pública e permitir leitura automática. Sites que exigem login ou bloqueiam a leitura, inclusive o iFood, ainda não são compatíveis.",
    },
];

export default function CriarCardapioComIaPage() {
    return (
        <BlogArticle
            article={article}
            icon={faWandMagicSparkles}
            takeaways={[
                "Como importar cardápios com IA usando fotos, PDFs ou links públicos",
                "Um checklist de qualidade para melhorar a leitura da inteligência artificial",
                "Os pontos que precisam ser revisados antes de colocar o cardápio no ar",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-montar-cardapio-delivery",
                "controle-estoque-cardapio-digital",
                "como-aumentar-ticket-medio-restaurante",
            ]}
            ctaTitle="Transforme seu cardápio atual em uma versão digital sem cadastrar tudo do zero"
        >
            <BlogSection id="como-funciona" title="Como funciona um criador de cardápio com IA">
                <p>
                    Cadastrar um cardápio do zero é simples quando existem poucos produtos.
                    O trabalho cresce quando o restaurante já tem dezenas de itens,
                    categorias, descrições e preços em um arquivo antigo, imagem de designer
                    ou cardápio impresso.
                </p>
                <p>
                    Um <strong>Scan de cardápio com IA</strong> encurta essa etapa. Em vez de
                    digitar produto por produto, você envia o material que já possui e deixa
                    a inteligência artificial identificar a estrutura inicial. Depois, você
                    revisa o resultado e salva no cardápio digital.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ["1. Enviar", "Adicione fotos ou PDFs, ou cole o link público do cardápio."],
                        ["2. Detectar", "A IA identifica categorias, produtos, descrições e preços que consegue ler."],
                        ["3. Organizar", "Revise as categorias detectadas, salve e ajuste o que precisar no cardápio."],
                    ].map(([title, description]) => (
                        <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
                <BlogCallout title="IA acelera o cadastro; ela não elimina a revisão" variant="tip">
                    Preço errado, produto duplicado ou texto mal lido ainda pode acontecer.
                    O ganho está em começar com uma estrutura pronta em vez de uma tela vazia.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="arquivos" title="Fotos, PDFs ou links: como importar seu cardápio">
                <p>
                    A qualidade da entrada influencia diretamente a leitura. Um arquivo
                    bonito para impressão nem sempre é o arquivo mais fácil para uma IA
                    interpretar.
                </p>
                <BlogChecklist
                    items={[
                        "Prefira imagem nítida e em boa resolução",
                        "Fotografe o cardápio de frente, sem perspectiva inclinada",
                        "Evite reflexos de luz em cardápios plastificados",
                        "Garanta contraste entre texto e fundo",
                        "Não corte preço, nome do produto ou título da categoria",
                        "Se o cardápio tiver várias páginas, envie todas na ordem correta",
                        "Evite anotações, adesivos ou objetos cobrindo produtos",
                        "Quando houver PDF e imagens originais, teste as imagens primeiro",
                    ]}
                />
                <p>
                    No iMenu, o Scan com IA aceita <strong>JPG, PNG e PDF</strong> e permite
                    selecionar até oito arquivos por análise. Também é possível abrir a
                    câmera do celular ou escolher <strong>Link do cardápio</strong>.
                </p>
                <p>
                    Para importar por link, cole uma página pública que exiba produtos.
                    Sites que exigem login, bloqueiam leitura automática ou carregam
                    conteúdo inacessível ao importador podem não funcionar. Links do
                    iFood ainda não são compatíveis.
                </p>
            </BlogSection>

            <BlogSection id="passo-a-passo" title="Como criar o cardápio com IA no iMenu">
                <BlogSteps
                    items={[
                        {
                            title: "Abra o Cardápio no painel",
                            description: "Entre na área de gerenciamento do cardápio do restaurante e abra o recurso de Scan com IA.",
                        },
                        {
                            title: "Envie arquivos ou cole o link",
                            description: "Selecione até oito imagens ou PDFs, use a câmera ou cole um link público compatível na opção Link do cardápio.",
                        },
                        {
                            title: "Aguarde o envio",
                            description: "Aguarde os uploads terminarem ou, se usou link, confirme que o site está público e permite leitura automática.",
                        },
                        {
                            title: "Inicie o Scan com IA",
                            description: "O sistema analisa os arquivos ou o conteúdo acessível do link e identifica itens e categorias.",
                        },
                        {
                            title: "Mapeie as categorias",
                            description: "Para cada categoria detectada, escolha criar uma nova ou associar os produtos a uma categoria que já existe.",
                        },
                        {
                            title: "Salve e revise o cardápio",
                            description: "Depois de salvar os itens, confira o cardápio normal e ajuste qualquer nome, descrição, preço, imagem ou organização necessária.",
                        },
                    ]}
                />
            </BlogSection>

            <BlogSection id="revisao" title="O que revisar antes de publicar o cardápio gerado por IA">
                <p>
                    A revisão deve ser rápida, mas não opcional. O cardápio é uma fonte de
                    preço e composição do pedido; um erro de leitura pode virar cobrança
                    errada ou dúvida no atendimento.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Campo</th>
                                <th className="px-5 py-4 font-bold">O que conferir</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Categoria</td><td className="px-5 py-4">Se cada produto caiu na seção correta e não foram criadas categorias duplicadas.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Nome</td><td className="px-5 py-4">Acentos, tamanhos, sabores e abreviações que possam ter sido lidos errado.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Descrição</td><td className="px-5 py-4">Ingredientes, quantidade, peso e informações que ajudam o cliente a escolher.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Preço</td><td className="px-5 py-4">Vírgulas, casas decimais, preços promocionais e valores de diferentes tamanhos.</td></tr>
                            <tr><td className="px-5 py-4 font-semibold text-gray-900">Disponibilidade</td><td className="px-5 py-4">Se itens antigos ou sazonais ainda devem aparecer no cardápio novo.</td></tr>
                        </tbody>
                    </table>
                </div>
                <BlogCallout title="Confira principalmente os preços" variant="warning">
                    Uma palavra lida com erro é inconveniente. Um preço lido com erro afeta
                    diretamente o pedido. Faça uma passada final comparando os valores com o
                    material original.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="quando-usar" title="Quando o Scan de cardápio com IA mais economiza tempo">
                <BlogSubheading>Restaurante migrando de outro sistema</BlogSubheading>
                <p>
                    Se você já possui um cardápio em outro site público, PDF, arte ou
                    material impresso, o scan evita reconstruir manualmente a primeira versão.
                </p>
                <BlogSubheading>Cardápio grande</BlogSubheading>
                <p>
                    Pizzarias, lanchonetes, restaurantes japoneses e operações com muitas
                    categorias sentem mais o custo de digitar dezenas de produtos. Quanto
                    maior o catálogo, maior tende a ser a economia de tempo no cadastro
                    inicial.
                </p>
                <BlogSubheading>Cardápio disponível apenas no papel</BlogSubheading>
                <p>
                    Mesmo sem arquivo de designer, uma boa foto pode servir como ponto de
                    partida. Depois do scan, o conteúdo deixa de ser uma imagem fechada e
                    passa a existir como produtos editáveis no sistema.
                </p>
                <BlogSubheading>Criação de uma segunda unidade</BlogSubheading>
                <p>
                    Quando outra unidade possui material parecido, digitalizar o documento
                    pode ser mais rápido do que repetir o cadastro item por item.
                </p>
            </BlogSection>

            <BlogSection id="erros" title="Erros comuns ao usar IA para criar cardápio">
                <BlogChecklist
                    items={[
                        "Enviar uma foto borrada e esperar leitura perfeita",
                        "Fotografar com reflexo cobrindo preço ou descrição",
                        "Misturar versões antigas e novas do cardápio no mesmo scan",
                        "Salvar sem conferir preços detectados",
                        "Criar categorias duplicadas sem usar o mapeamento para uma categoria existente",
                        "Publicar itens sazonais que não estão mais disponíveis",
                        "Tratar o scan como substituto da organização do cardápio",
                        "Esquecer de configurar adicionais, complementos e disponibilidade depois do cadastro base",
                    ]}
                />
            </BlogSection>

            <BlogSection id="depois" title="Depois do Scan: transforme cadastro em um cardápio que vende">
                <p>
                    O scan resolve a etapa de entrada de dados. O próximo ganho vem de
                    organizar o cardápio para o cliente escolher com menos esforço. Revise a
                    ordem das categorias, destaque produtos importantes, configure
                    complementos e mantenha indisponíveis os itens que não podem ser vendidos.
                </p>
                <p>
                    Para aprofundar essa etapa, use nosso guia completo de <strong>como
                    montar um cardápio de delivery</strong>. Ele cobre mix, categorias,
                    descrições, preço, fotos e adicionais sem depender apenas da estrutura do
                    arquivo antigo.
                </p>
                <BlogCallout title="Não copie os problemas do cardápio antigo" variant="info">
                    Digitalizar rápido é ótimo, mas aproveite a migração para remover item
                    repetido, categoria confusa e descrição que não ajuda o cliente a decidir.
                </BlogCallout>
            </BlogSection>
        </BlogArticle>
    );
}

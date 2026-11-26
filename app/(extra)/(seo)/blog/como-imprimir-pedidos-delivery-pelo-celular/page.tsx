import Link from "next/link";
import { faPrint } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("como-imprimir-pedidos-delivery-pelo-celular")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "como-funciona", label: "Como funciona" },
    { id: "impressora", label: "Impressoras compatíveis" },
    { id: "passo-a-passo", label: "Como imprimir pelo celular" },
    { id: "comanda", label: "Personalizar a comanda" },
    { id: "manual-ou-automatica", label: "Manual ou automática?" },
    { id: "problemas", label: "Problemas de impressão" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "É possível imprimir pedidos de delivery pelo celular sem computador?",
        answer: "Sim. No iMenu, ative o Modo Impressão pelo Celular na página Impressora, baixe a comanda em PDF diretamente pelo cartão do pedido e imprima usando um aplicativo compatível com sua impressora.",
    },
    {
        question: "O iMenu imprime automaticamente pelo celular?",
        answer: "Não. A impressão pelo celular é manual: o restaurante baixa o PDF e envia o arquivo à impressora. Para impressão automática, recomendamos o iMenu Impressora em um computador Windows.",
    },
    {
        question: "Posso usar uma impressora térmica Bluetooth?",
        answer: "Sim, se houver um aplicativo compatível com o modelo da impressora, com seu celular e com a impressão de arquivos PDF. A conexão Bluetooth, por si só, não garante compatibilidade.",
    },
    {
        question: "Qual tamanho de papel posso usar para imprimir comandas?",
        answer: "O Modo Impressão pelo Celular oferece PDF nos formatos 58 mm, 80 mm e A4. Escolha o formato correspondente à impressora utilizada.",
    },
    {
        question: "Posso imprimir um pedido antigo?",
        answer: "Sim. Com o modo ativado, abra o pedido na página Histórico do painel do iMenu e use o botão Imprimir.",
    },
];

export default function ImprimirPedidosPeloCelularPage() {
    return (
        <BlogArticle
            article={article}
            icon={faPrint}
            takeaways={[
                "Imprima comandas em PDF pelo celular sem precisar de computador",
                "Confira se seu aplicativo de impressão aceita PDFs e é compatível com a impressora",
                "Baixe a comanda diretamente no cartão do pedido",
                "Entenda por que a impressão automática pelo Windows continua recomendada",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["como-vender-delivery-pelo-whatsapp", "integracao-ifood-imenu", "aplicativo-para-garcom"]}
            ctaTitle="Receba e organize os pedidos do seu delivery com o iMenu"
        >
            <BlogSection id="como-funciona" title="Como funciona a impressão de pedidos pelo celular?">
                <p>
                    Se você administra um delivery, uma lanchonete ou uma pequena cozinha sem
                    computador, pode usar o celular para receber pedidos e imprimir as comandas.
                    A comanda impressa ajuda a equipe a conferir os produtos, quantidades e
                    observações durante o preparo.
                </p>
                <p>
                    No iMenu, o <strong>Modo Impressão pelo Celular</strong> transforma a
                    comanda do pedido em um arquivo PDF. Você abre esse arquivo em um aplicativo
                    compatível com sua impressora e envia a impressão manualmente.
                    Não é necessário instalar o aplicativo iMenu Impressora para Windows no celular.
                </p>
            </BlogSection>

            <BlogSection id="impressora" title="Qual impressora usar para imprimir comandas pelo celular?">
                <p>
                    Antes de comprar uma impressora térmica Bluetooth ou de rede, confira se o
                    fabricante oferece um aplicativo compatível com o sistema do seu celular
                    e com a impressão de PDF. O tipo de conexão não garante que o aplicativo
                    consiga imprimir o arquivo no formato correto.
                </p>
                <BlogChecklist items={[
                    "Impressora compatível com o aplicativo instalado no seu celular",
                    "Aplicativo capaz de abrir ou importar arquivos PDF para impressão",
                    "Conexão entre o celular e a impressora conforme o manual do fabricante",
                    "Papel adequado: 58 mm, 80 mm ou A4, conforme o modelo",
                ]} />
                <BlogCallout title="Faça um teste antes de comprar" variant="tip">
                    Se possível, confira com o vendedor ou fabricante se o modelo imprime PDF
                    pelo seu celular. Não conte apenas com a indicação de conexão Bluetooth.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="passo-a-passo" title="Como imprimir pedidos de delivery pelo celular no iMenu">
                <BlogSteps items={[
                    {
                        title: "Ative a impressão pelo celular",
                        description: "No painel do iMenu, acesse Impressora e ative o Modo Impressão pelo Celular.",
                    },
                    {
                        title: "Abra a página Pedidos",
                        description: "Com o modo ativo, os cartões dos pedidos exibem um ícone de impressora ao lado dos demais botões de ação.",
                    },
                    {
                        title: "Baixe a comanda em PDF",
                        description: "Toque no ícone de impressora diretamente no cartão do pedido. O iMenu gera o PDF da comanda; não é necessário abrir os detalhes do pedido.",
                    },
                    {
                        title: "Imprima pelo aplicativo compatível",
                        description: "Abra o PDF no aplicativo da sua impressora, confira o formato do papel e envie a impressão manualmente.",
                    },
                ]} />
                <p>
                    Para começar, acesse <Link href="/painel/impressora" className="font-semibold text-brand underline">Impressora</Link>.
                    {" "} Para imprimir um pedido que já foi concluído, abra seus detalhes no
                    {" "}<Link href="/painel/historico" className="font-semibold text-brand underline">Histórico</Link>
                    {" "} do painel e use o botão Imprimir.
                </p>
            </BlogSection>

            <BlogSection id="comanda" title="Como ajustar o PDF da comanda para papel térmico">
                <p>
                    A personalização é opcional. Na página Impressora, você pode selecionar
                    papel de 58 mm, 80 mm ou A4, alterar o tamanho do texto, o título, o rodapé
                    e os campos exibidos na comanda. A prévia mostra como ficará o documento.
                </p>
                <p>
                    Use a opção <strong>Baixar comanda de teste</strong> para experimentar o
                    formato sem depender de um pedido real. Se o texto estiver cortado ou
                    muito pequeno, confira tanto a largura selecionada no iMenu quanto
                    o tamanho de papel e a escala definidos no aplicativo de impressão.
                </p>
            </BlogSection>

            <BlogSection id="manual-ou-automatica" title="Impressão manual pelo celular ou automática pelo computador?">
                <BlogSubheading>Impressão manual pelo celular</BlogSubheading>
                <p>
                    É uma alternativa para quem realmente não possui computador. A cada
                    pedido que deseja imprimir, o restaurante precisa baixar o PDF e enviar
                    o arquivo à impressora pelo aplicativo compatível. Não há impressão
                    automática de novos pedidos nesse modo.
                </p>
                <BlogSubheading>Impressão automática pelo Windows</BlogSubheading>
                <p>
                    Para restaurantes com computador Windows, continuamos recomendando o
                    iMenu Impressora. Com o programa aberto, a impressora configurada e a
                    impressão automática habilitada, novos pedidos podem ser impressos
                    sem precisar baixar uma comanda por vez. Isso reduz o trabalho manual
                    especialmente nos horários de maior movimento.
                </p>
                <BlogCallout title="Qual escolher?" variant="tip">
                    Se você já tem um computador Windows no estabelecimento, prefira a
                    impressão automática. Use a impressão pelo celular quando não houver
                    um computador disponível para a operação.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="problemas" title="O que fazer se a comanda não imprimir pelo celular?">
                <BlogChecklist items={[
                    "Se o ícone de impressora não aparecer, confira se o Modo Impressão pelo Celular está ativo na página Impressora.",
                    "Se o PDF foi baixado mas não saiu no papel, confira a conexão da impressora no aplicativo usado para imprimir.",
                    "Se o aplicativo não abrir o PDF, consulte o fabricante sobre um aplicativo compatível com seu modelo.",
                    "Se a comanda sair cortada, revise a largura de papel selecionada e as opções de escala do aplicativo.",
                    "Teste novamente com a comanda de teste antes de imprimir novos pedidos.",
                ]} />
                <p>
                    O download do PDF não confirma que a impressão física ocorreu.
                    Confira se a comanda saiu no papel antes de encaminhar o pedido para
                    a cozinha ou tentar imprimi-la novamente.
                </p>
                <p>
                    Além da impressão, organize os pedidos em um único painel para reduzir
                    a necessidade de copiar informações entre aplicativos. Veja também
                    {" "}<Link href="/blog/como-vender-delivery-pelo-whatsapp" className="font-semibold text-brand underline">como vender delivery pelo WhatsApp</Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faFileInvoice } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("nfce-para-restaurantes")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é NFC-e" },
    { id: "requisitos", label: "Requisitos para emitir" },
    { id: "como-emitir", label: "Como emitir nota fiscal" },
    { id: "delivery", label: "Salão, retirada e delivery" },
    { id: "automatizar", label: "Emissão automática" },
    { id: "documentos", label: "XML e DANFE" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "O que é NFC-e para restaurantes?",
        answer: "É a Nota Fiscal de Consumidor Eletrônica, usada para documentar operações de venda ao consumidor. A comanda e o comprovante de pagamento não substituem o documento fiscal exigido para a operação.",
    },
    {
        question: "Todo restaurante precisa emitir NFC-e?",
        answer: "A obrigação e o documento fiscal adequado dependem do estado, do enquadramento da empresa e da operação. Confirme com a contabilidade quais regras se aplicam ao seu estabelecimento.",
    },
    {
        question: "Preciso pedir CPF para emitir nota fiscal no delivery?",
        answer: "A identificação depende das regras fiscais aplicáveis à entrega. No iMenu, quando a emissão de NFC-e para delivery está configurada e habilitada, o checkout de entrega pelo cardápio exige CPF válido.",
    },
    {
        question: "Qual a diferença entre XML e DANFE?",
        answer: "O XML contém os dados eletrônicos da nota fiscal. O DANFE é sua representação auxiliar, que pode ser consultada em PDF. Organize os XMLs, não apenas os PDFs.",
    },
    {
        question: "O iMenu emite nota fiscal automaticamente?",
        answer: "Sim, o iMenu Plus oferece emissão automática de NFC-e para restaurantes do Simples Nacional em São Paulo, desde que a configuração fiscal esteja válida e o pedido seja elegível. Consulte a disponibilidade antes de contratar.",
    },
];

export default function NfceParaRestaurantesPage() {
    return (
        <BlogArticle
            article={article}
            icon={faFileInvoice}
            takeaways={[
                "Diferencie nota fiscal, comanda e comprovante de pagamento",
                "Organize os requisitos fiscais antes de configurar a emissão",
                "Entenda o impacto da identificação do consumidor no delivery",
                "Automatize a emissão de pedidos elegíveis e organize os XMLs",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["nfce-para-restaurantes-sao-paulo", "como-fazer-fechamento-de-caixa-restaurante", "imenu-plus"]}
            ctaTitle="Centralize os pedidos e a gestão do seu restaurante com o iMenu"
        >
            <BlogSection id="o-que-e" title="O que é NFC-e e para que serve no restaurante?">
                <p>
                    A <strong>Nota Fiscal de Consumidor Eletrônica (NFC-e)</strong> é um documento
                    fiscal eletrônico utilizado para registrar vendas ao consumidor. Em uma operação
                    de restaurante, o pedido informa o que preparar, o pagamento registra o
                    recebimento e a nota fiscal documenta a venda para fins fiscais.
                </p>
                <p>
                    Uma comanda de cozinha, o comprovante da maquininha ou a confirmação do Pix
                    não substituem a nota fiscal quando sua emissão é obrigatória. Integrar
                    esses processos ajuda a reduzir digitação repetida e facilita encontrar a
                    venda correspondente quando o cliente ou a contabilidade precisa do documento.
                </p>
                <BlogCallout title="Antes de escolher um emissor" variant="tip">
                    Confirme com seu contador o documento fiscal exigido para cada operação
                    do restaurante. As regras de credenciamento e emissão podem variar conforme
                    o estado e o regime tributário.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="requisitos" title="O que um restaurante precisa para emitir NFC-e?">
                <p>
                    Antes de configurar um sistema emissor, reúna os dados da empresa e
                    as informações fiscais dos produtos. O cadastro comercial de um prato,
                    com nome e preço, não substitui sua classificação tributária.
                </p>
                <BlogChecklist items={[
                    "CNPJ, razão social, inscrição estadual e endereço fiscal do estabelecimento",
                    "Credenciamento e requisitos da Secretaria da Fazenda responsável pela empresa",
                    "Certificado digital válido e demais credenciais exigidas pelo emissor e pela SEFAZ",
                    "Classificação tributária dos produtos, incluindo NCM, CFOP e códigos do regime aplicável",
                    "Série e numeração fiscal, conferidas com a contabilidade",
                ]} />
                <p>
                    Evite copiar os códigos fiscais de outro restaurante: produtos semelhantes
                    podem ter tratamentos tributários diferentes. Verifique também se o emissor
                    atende ao seu estado e ao enquadramento da empresa.
                </p>
            </BlogSection>

            <BlogSection id="como-emitir" title="Como emitir nota fiscal no restaurante: passo a passo">
                <BlogSteps items={[
                    { title: "Valide os requisitos com a contabilidade", description: "Identifique o documento fiscal correto, o regime tributário e as exigências estaduais para sua operação." },
                    { title: "Escolha um emissor compatível", description: "Confira a integração com pedidos, as condições de emissão e a possibilidade de exportar XML e DANFE." },
                    { title: "Configure o estabelecimento e os produtos", description: "Cadastre os dados do emitente, certificado e regras fiscais validadas pelo contador." },
                    { title: "Confira o fluxo antes de automatizar", description: "Verifique quais pedidos geram nota, em qual etapa e quais dados precisam estar presentes." },
                    { title: "Acompanhe o retorno da emissão", description: "Confira a autorização, trate rejeições e mantenha os documentos fiscais organizados." },
                ]} />
                <p>
                    Um pedido concluído não prova, por si só, que sua nota foi autorizada.
                    Consulte a situação fiscal no emissor e investigue documentos rejeitados
                    antes de considerar a rotina encerrada.
                </p>
            </BlogSection>

            <BlogSection id="delivery" title="Nota fiscal no delivery, no balcão e nas mesas: o que muda?">
                <BlogSubheading>Salão e retirada</BlogSubheading>
                <p>
                    Em operações presenciais e de retirada, o fluxo fiscal pode acompanhar
                    a conclusão do pedido e o pagamento. Confirme as condições em que
                    a identificação do consumidor é necessária.
                </p>
                <BlogSubheading>Delivery</BlogSubheading>
                <p>
                    Na entrega, os dados do destinatário e do endereço podem ser necessários
                    para a emissão fiscal. Se o checkout solicitar informações adicionais,
                    explique ao consumidor a finalidade do preenchimento.
                </p>
                <p>
                    No iMenu, a emissão para salão, retirada e delivery pode ser configurada
                    separadamente. Delivery vem desativado por padrão: quando habilitado
                    com a configuração fiscal válida, o checkout de entrega pelo cardápio
                    solicita CPF válido. Pedidos sem CPF fiscal registrado não são elegíveis
                    para essa emissão.
                </p>
                <BlogCallout title="Equilibre emissão e experiência de compra" variant="tip">
                    A exigência de CPF no delivery adiciona uma etapa ao checkout. Avalie
                    o impacto na conversão e alinhe com seu contador como atender às
                    obrigações fiscais de cada canal.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="automatizar" title="Como automatizar a emissão de NFC-e dos pedidos">
                <p>
                    Um sistema integrado reaproveita os dados da venda para reduzir o trabalho
                    de cadastrar pedidos novamente no emissor. Antes de automatizar, confira
                    a correspondência entre itens, descontos, pagamento e valor final.
                </p>
                <p>
                    O <Link href="/painel/planos" className="font-semibold text-brand underline">iMenu Plus</Link>
                    {" "} inclui emissão automática de NFC-e para pedidos elegíveis, sem limite de
                    notas, atualmente para empresas do Simples Nacional em São Paulo. A emissão
                    depende de configuração fiscal válida. Restaurantes de outros estados devem
                    verificar a disponibilidade de um emissor compatível com sua operação.
                </p>
                <p>
                    Se seu restaurante atende aos requisitos do iMenu, abra
                    {" "}<Link href="/painel/configuracoes" className="font-semibold text-brand underline">Configurações</Link>,
                    na área de Modos, e procure Notas Fiscais. Para o passo a passo específico,
                    consulte o <Link href="/blog/nfce-para-restaurantes-sao-paulo" className="font-semibold text-brand underline">guia de configuração da NFC-e no iMenu</Link>.
                </p>
            </BlogSection>

            <BlogSection id="documentos" title="Como organizar XML e DANFE em PDF das notas fiscais">
                <p>
                    O XML é o arquivo eletrônico da nota; o DANFE é sua representação auxiliar.
                    Guarde os documentos eletrônicos de forma organizada e siga o prazo de guarda
                    aplicável à empresa, conforme orientação contábil.
                </p>
                <p>
                    No <Link href="/painel/historico" className="font-semibold text-brand underline">Histórico de Pedidos do iMenu</Link>,
                    a opção Notas Fiscais permite consultar documentos por período, baixar XML e PDF
                    individualmente e exportar os arquivos de um período em ZIP.
                </p>
                <BlogChecklist items={[
                    "Confira regularmente a situação das notas emitidas e rejeitadas",
                    "Exporte os XMLs por período e mantenha cópias de segurança",
                    "Use os PDFs para consulta, sem substituir os XMLs",
                    "Compare as vendas e os documentos fiscais com os registros do caixa",
                ]} />
                <p>
                    Combine essa rotina com o
                    {" "}<Link href="/blog/como-fazer-fechamento-de-caixa-restaurante" className="font-semibold text-brand underline">fechamento de caixa do restaurante</Link>.
                    A conferência financeira e a emissão fiscal são tarefas complementares.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

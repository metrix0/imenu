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

const article = getBlogArticle("nfce-para-restaurantes-sao-paulo")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é NFC-e" },
    { id: "quem-pode", label: "Quem pode usar" },
    { id: "configurar", label: "Como configurar" },
    { id: "emitir", label: "Emissão de notas" },
    { id: "pdf-xml", label: "Baixar PDF e XML" },
    { id: "cuidados", label: "Boas práticas" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "O que é uma NFC-e para restaurantes?",
        answer: "A NFC-e é um documento fiscal eletrônico usado para registrar operações de venda ao consumidor. O XML contém os dados fiscais da nota; o DANFE é sua representação auxiliar em formato de consulta.",
    },
    {
        question: "O iMenu emite NFC-e em São Paulo?",
        answer: "O iMenu Plus oferece a configuração de emissão de NFC-e para empresas do Simples Nacional em São Paulo, conforme os requisitos fiscais e a disponibilidade do ambiente de emissão.",
    },
    {
        question: "Preciso de certificado digital A1 para emitir?",
        answer: "Sim. A configuração fiscal do iMenu exige certificado digital A1 válido, além dos dados da empresa e das classificações tributárias necessárias.",
    },
    {
        question: "Como baixar o XML e o PDF da nota fiscal?",
        answer: "No Histórico do iMenu, abra Notas Fiscais. É possível localizar notas por período e baixar XML e PDF individualmente ou um arquivo ZIP com os documentos do período selecionado.",
    },
    {
        question: "Posso emitir NFC-e de pedidos de delivery?",
        answer: "O fluxo de emissão considera dados do pedido e, quando aplicável, o endereço de entrega registrado. É importante manter os dados necessários completos e seguir as regras fiscais da operação.",
    },
    {
        question: "O que acontece com notas já emitidas quando o Plus termina?",
        answer: "O histórico de notas emitidas permanece disponível para exportação pelo fluxo fiscal. O vencimento do Plus interrompe a emissão de novas NFC-e, mas não dispensa a guarda dos documentos fiscais.",
    },
];

export default function NfceParaRestaurantesSaoPauloPage() {
    return (
        <BlogArticle
            article={article}
            icon={faFileInvoice}
            takeaways={[
                "Entenda a diferença entre NFC-e, DANFE em PDF e arquivo XML",
                "Veja quais dados e certificado o restaurante deve configurar",
                "Aprenda a localizar, filtrar e baixar suas notas pelo Histórico do iMenu",
                "Organize os arquivos fiscais mesmo depois de alterar o plano",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["imenu-plus", "como-fazer-fechamento-de-caixa-restaurante", "como-montar-cardapio-delivery"]}
            ctaTitle="Organize a emissão de notas do seu restaurante com o iMenu"
        >
            <BlogSection id="o-que-e" title="NFC-e para restaurantes: o que é e por que organizar os documentos fiscais">
                <p>
                    Quem administra um restaurante precisa acompanhar mais do que os pedidos e os pagamentos.
                    A emissão da <strong>Nota Fiscal de Consumidor Eletrônica (NFC-e)</strong> faz parte da
                    rotina fiscal de muitas operações de balcão, retirada e delivery. Ter os documentos
                    associados aos pedidos ajuda a localizar vendas, atender solicitações e manter
                    os registros organizados.
                </p>
                <p>
                    A NFC-e é o documento fiscal eletrônico. O <strong>XML</strong> guarda seus dados
                    estruturados e os eventos fiscais; o <strong>DANFE NFC-e</strong> apresenta uma
                    representação auxiliar, que pode ser baixada em PDF. Os dois formatos têm
                    finalidades diferentes: salvar apenas o PDF não substitui a organização dos XMLs.
                </p>
                <p>
                    Com um sistema de pedidos integrado à emissão fiscal, o restaurante pode consultar
                    a nota no contexto da venda em vez de procurar arquivos desconectados dos pedidos.
                    No iMenu, essa experiência se concentra em <strong>Configurações</strong> e
                    <strong> Histórico</strong>.
                </p>
            </BlogSection>

            <BlogSection id="quem-pode" title="Quem pode configurar NFC-e pelo iMenu em São Paulo">
                <p>
                    O recurso de <strong>Notas Fiscais do iMenu Plus</strong> é direcionado a restaurantes
                    do <strong>Simples Nacional no estado de São Paulo</strong>. A emissão depende
                    dos dados fiscais da empresa, de um certificado digital A1 válido e das condições
                    do ambiente de emissão configurado.
                </p>
                <p>
                    Antes do primeiro uso, confira com a contabilidade o enquadramento do estabelecimento,
                    as regras tributárias aplicáveis aos itens e as informações que constarão nas notas.
                    Os dados de emissão precisam corresponder ao cadastro fiscal real do restaurante.
                </p>
                <BlogCallout title="Onde encontrar a opção" variant="tip">
                    No painel do iMenu, abra <Link href="/painel/configuracoes" className="font-semibold text-brand underline">Configurações</Link> e
                    procure <strong>Notas Fiscais</strong> na área de Modos. O recurso faz parte do
                    <Link href="/painel/planos" className="font-semibold text-brand underline"> iMenu Plus</Link>.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="configurar" title="Como configurar a NFC-e no restaurante: passo a passo">
                <p>
                    A configuração inicial reúne identidade do emitente, endereços, numeração e
                    tributação. Organize essas informações com antecedência para evitar retrabalho
                    na hora de emitir a primeira nota.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra Notas Fiscais nas configurações do iMenu",
                        description: "No painel, acesse Configurações → Notas Fiscais. Verifique o acesso ao recurso pelo iMenu Plus.",
                    },
                    {
                        title: "Preencha os dados fiscais do restaurante",
                        description: "Informe CNPJ, inscrição estadual, razão social, endereço e código do município, além da série e da próxima numeração da NFC-e.",
                    },
                    {
                        title: "Configure a tributação dos produtos",
                        description: "Confira NCM, CFOP, CSOSN, origem e, quando aplicável, CEST. Essas classificações devem corresponder às operações e aos produtos da empresa.",
                    },
                    {
                        title: "Cadastre o certificado digital A1",
                        description: "Envie o certificado e informe sua senha na configuração fiscal do painel. O certificado deve pertencer ao emitente e estar válido.",
                    },
                    {
                        title: "Ative e confira a situação da emissão",
                        description: "A opção de emissão pode ser solicitada no painel. Se aparecer “Não configurado”, conclua os dados pendentes antes de contar com a geração automática.",
                    },
                ]} />
                <p>
                    As configurações podem incluir dados por produto, quando necessário. Mantenha
                    as informações fiscais atualizadas sempre que seu catálogo ou sua operação mudar.
                    Se houver alguma classificação desconhecida, obtenha a orientação da contabilidade
                    antes de preenchê-la.
                </p>
            </BlogSection>

            <BlogSection id="emitir" title="Como funciona a emissão automática de NFC-e nos pedidos">
                <p>
                    Com o Plus e a configuração fiscal válidos, o iMenu pode gerar a NFC-e de pedidos
                    elegíveis sem que o restaurante precise redigitar os itens da venda. O sistema
                    mantém uma relação entre pedido e documento fiscal para facilitar a consulta.
                    O status do pedido, o tipo de operação e os dados fiscais disponíveis fazem
                    diferença na emissão.
                </p>
                <BlogSubheading>Pedidos no balcão e para retirada</BlogSubheading>
                <p>
                    No balcão e na retirada, a emissão pode seguir o fluxo da operação
                    configurada. O checkout do iMenu não exige CPF do consumidor para acionar
                    esse recurso; a obrigatoriedade de dados do destinatário em uma situação
                    específica deve ser avaliada conforme as regras aplicáveis.
                </p>
                <BlogSubheading>Pedidos de delivery</BlogSubheading>
                <p>
                    Para entregas, o sistema utiliza o endereço registrado no pedido quando
                    aplicável. Por isso, é importante manter rua, número, bairro e demais
                    informações necessárias corretamente preenchidos. Uma nota já autorizada
                    não é alterada automaticamente se o pedido for editado depois.
                </p>
            </BlogSection>

            <BlogSection id="pdf-xml" title="Como baixar DANFE em PDF, XML e notas fiscais por período">
                <p>
                    O painel <Link href="/painel/historico" className="font-semibold text-brand underline">Histórico de Pedidos</Link> concentra
                    os documentos emitidos. Abra <strong>Notas Fiscais</strong>, escolha o período
                    desejado e consulte as notas disponíveis. A lista permite localizar a venda
                    correspondente e acessar seus arquivos.
                </p>
                <BlogChecklist items={[
                    "PDF: abra ou baixe o DANFE da NFC-e para consulta e compartilhamento quando necessário",
                    "XML: baixe o documento eletrônico da nota e organize-o junto aos demais registros fiscais",
                    "Período: filtre as notas por datas para localizar documentos de um dia, semana ou mês",
                    "Baixar todas: gere um ZIP com os arquivos do período selecionado",
                    "Pedido individual: consulte os dados da NFC-e no detalhe do pedido correspondente",
                ]} />
                <p>
                    O histórico fiscal também permite exportar o arquivo de notas anteriores
                    após o encerramento do Plus. Isso não elimina a responsabilidade do
                    restaurante de guardar os XMLs conforme as obrigações fiscais aplicáveis.
                    Faça cópias organizadas por período e mantenha um processo regular de conferência.
                </p>
            </BlogSection>

            <BlogSection id="cuidados" title="Boas práticas para evitar problemas com NFC-e no restaurante">
                <p>
                    A automação reduz etapas repetitivas, mas ainda depende de dados corretos.
                    Uma conferência simples antes de iniciar e ao longo da operação evita
                    dúvidas sobre notas, valores ou documentos ausentes no arquivo.
                </p>
                <BlogChecklist items={[
                    "Confirme com a contabilidade os dados cadastrais e as classificações fiscais dos produtos",
                    "Verifique a validade do certificado A1 e a situação da configuração de emissão",
                    "Confira se os endereços dos pedidos de delivery estão completos",
                    "Acompanhe notas pendentes ou rejeitadas antes de tratar a venda como fiscalmente concluída",
                    "Não presuma que editar o pedido atualizará uma nota já autorizada",
                    "Exporte e guarde os XMLs de forma organizada, com uma rotina de conferência",
                ]} />
                <p>
                    Se uma NFC-e precisar ser corrigida, cancelada ou substituída, verifique o
                    procedimento fiscal adequado. O histórico do pedido ajuda a encontrar a venda,
                    mas não substitui a orientação contábil sobre prazos e obrigações.
                </p>
                <p>
                    Para restaurantes que também desejam organizar pagamentos, pedidos e caixa,
                    consulte o guia de <Link href="/blog/como-fazer-fechamento-de-caixa-restaurante" className="font-semibold text-brand underline">fechamento de caixa</Link>.
                    A emissão fiscal e o fechamento financeiro são processos complementares,
                    não sinônimos.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faQrcode } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import {
    createBlogArticleMetadata,
    getBlogArticle,
} from "@/lib/seo/blogArticles";

const article = getBlogArticle("melhor-qr-code-mesa-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "ranking", label: "Ranking" },
    { id: "comparativo", label: "Comparativo rápido" },
    { id: "imenu", label: "1. iMenu" },
    { id: "goomer", label: "2. Goomer" },
    { id: "anota-ai", label: "3. Anota AI" },
    { id: "saipos", label: "4. Saipos" },
    { id: "como-escolher", label: "Como escolher" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Qual é o melhor QR Code para restaurante em 2026?",
        answer:
            "Para quem quer começar com baixo custo e receber pedidos identificados por mesa, o iMenu oferece uma proposta simples: cardápio digital grátis e o QR Code Mesa por R$ 4,90 por mês. Goomer, Anota AI e Saipos também têm soluções fortes, especialmente quando o restaurante já usa seus ecossistemas.",
    },
    {
        question: "Qual sistema permite o cliente pedir direto pelo QR Code da mesa?",
        answer:
            "iMenu, Goomer, Anota AI e Saipos oferecem fluxos em que o cliente acessa o cardápio pelo celular e pode enviar pedidos vinculados à mesa, conforme o plano e a configuração escolhidos.",
    },
    {
        question: "Precisa instalar aplicativo para pedir pelo QR Code?",
        answer:
            "Não nas soluções comparadas. O cliente acessa o cardápio pelo navegador do celular após escanear o QR Code.",
    },
    {
        question: "Quanto custa o QR Code Mesa do iMenu?",
        answer:
            "O iMenu QR Code Mesa custa R$ 4,90 por mês. O cardápio digital principal do iMenu é grátis para sempre e sem limites.",
    },
    {
        question: "QR Code por mesa é melhor do que um QR Code universal?",
        answer:
            "O QR individual reduz etapas porque a mesa já vem identificada. O QR universal é útil para começar rápido ou manter um único código de apoio, desde que o cliente selecione a mesa corretamente.",
    },
];

const sourceClass = "font-semibold text-brand underline underline-offset-2";

export default function MelhorQrCodeMesaRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faQrcode}
            takeaways={[
                "Quatro opções de QR Code para pedidos na mesa comparadas lado a lado",
                "Diferenças de preço, fluxo de pedido e integração com a operação",
                "Qual solução faz mais sentido para cada perfil de restaurante",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "cardapio-digital-qr-code-restaurante",
                "robo-whatsapp-para-restaurante",
                "controle-estoque-cardapio-digital",
            ]}
            ctaTitle="Crie seu cardápio digital grátis e receba pedidos direto da mesa"
        >
            <BlogSection
                id="ranking"
                title="Os 4 melhores sistemas de QR Code para mesa em 2026"
            >
                <p>
                    Para este comparativo, consideramos sistemas que vão além de simplesmente
                    abrir um PDF. O foco é <strong>QR Code para restaurante com pedido pela mesa</strong>:
                    o cliente escaneia, vê o cardápio no celular e consegue enviar o pedido
                    associado à mesa.
                </p>
                <p>
                    A lista foi montada com base nos recursos publicados pelas próprias
                    plataformas e revisada em agosto de 2026. Como este conteúdo é publicado
                    pelo iMenu, deixamos os critérios explícitos para você comparar por conta
                    própria: custo, facilidade para começar, identificação da mesa, envio do
                    pedido e integração com a operação.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            position: "1",
                            name: "iMenu QR Code Mesa",
                            bestFor: "Melhor custo-benefício para começar",
                            description:
                                "Cardápio digital grátis para sempre, QR Code individual ou universal e pedidos identificados por mesa por R$ 4,90/mês.",
                        },
                        {
                            position: "2",
                            name: "Goomer",
                            bestFor: "Melhor para operação integrada de salão",
                            description:
                                "QR Codes exclusivos por mesa, pedido direto do celular e envio para cozinha por monitor ou impressora.",
                        },
                        {
                            position: "3",
                            name: "Anota AI",
                            bestFor: "Melhor para quem também prioriza WhatsApp",
                            description:
                                "QR Code por mesa dentro de uma plataforma que também reúne automação de atendimento, PDV e outros recursos.",
                        },
                        {
                            position: "4",
                            name: "Saipos",
                            bestFor: "Melhor para quem já usa o sistema Saipos",
                            description:
                                "Cardápio QR Code integrado ao ecossistema de gestão, com versão de visualização e versão de pedido online.",
                        },
                    ].map((item) => (
                        <div
                            key={item.name}
                            className="rounded-2xl border border-gray-200 bg-white p-5"
                        >
                            <div className="flex items-start gap-4">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand font-bold text-white">
                                    {item.position}
                                </span>
                                <div>
                                    <h3 className="font-bold text-gray-950">{item.name}</h3>
                                    <p className="mt-1 text-sm font-semibold text-brand">{item.bestFor}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-gray-600">{item.description}</p>
                        </div>
                    ))}
                </div>

                <BlogCallout title="O melhor depende do que você já usa" variant="info">
                    Se o restaurante já opera com um PDV ou ecossistema específico, integração
                    pode pesar mais que preço. Se a prioridade é testar pedidos por mesa sem
                    aumentar muito o custo fixo, uma solução independente e simples tende a
                    fazer mais sentido.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="comparativo" title="Comparativo rápido: iMenu, Goomer, Anota AI e Saipos">
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Sistema</th>
                                <th className="px-5 py-4 font-bold">Pedido pelo cliente</th>
                                <th className="px-5 py-4 font-bold">Mesa identificada</th>
                                <th className="px-5 py-4 font-bold">Destaque</th>
                                <th className="px-5 py-4 font-bold">Preço do QR Mesa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-950">iMenu</td>
                                <td className="px-5 py-4">Sim</td>
                                <td className="px-5 py-4">QR individual ou universal</td>
                                <td className="px-5 py-4">Baixo custo e implantação simples</td>
                                <td className="px-5 py-4 font-semibold text-gray-950">R$ 4,90/mês</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-950">Goomer</td>
                                <td className="px-5 py-4">Sim</td>
                                <td className="px-5 py-4">QR exclusivo por mesa</td>
                                <td className="px-5 py-4">Integrações e operação de salão</td>
                                <td className="px-5 py-4">Consultar plano atual</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-950">Anota AI</td>
                                <td className="px-5 py-4">Sim</td>
                                <td className="px-5 py-4">QR único por mesa</td>
                                <td className="px-5 py-4">Automação de WhatsApp + salão</td>
                                <td className="px-5 py-4">Consultar plano atual</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-950">Saipos</td>
                                <td className="px-5 py-4">Sim, na versão com pedido online</td>
                                <td className="px-5 py-4">QR ligado à mesa/comanda</td>
                                <td className="px-5 py-4">Integração com gestão Saipos</td>
                                <td className="px-5 py-4">Sem adicional além do sistema, segundo a Saipos</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm leading-6 text-gray-500">
                    Preços e planos podem mudar. Quando a plataforma não publica um preço
                    específico para o recurso de mesa, indicamos “consultar plano atual” em vez
                    de estimar um valor.
                </p>
            </BlogSection>

            <BlogSection id="imenu" title="1. iMenu QR Code Mesa: melhor custo-benefício para começar">
                <p>
                    O <strong>iMenu QR Code Mesa</strong> foi pensado para transformar cada mesa
                    em um ponto de pedido sem obrigar o restaurante a contratar um sistema de
                    gestão completo. O cardápio digital do iMenu continua grátis para sempre e
                    sem limites; o recurso de pedidos por mesa custa <strong>R$ 4,90 por mês</strong>.
                </p>
                <p>
                    O restaurante pode gerar um QR Code individual para cada mesa ou usar um QR
                    universal, em que o cliente escolhe a mesa ao entrar. Depois do scan, o pedido
                    é feito no mesmo cardápio e chega identificado no painel.
                </p>
                <BlogChecklist
                    items={[
                        "Cardápio digital grátis para sempre, sem limites",
                        "QR Code individual por mesa",
                        "QR Code universal como alternativa",
                        "Pedido enviado pelo próprio celular do cliente",
                        "Mesa identificada junto do pedido",
                        "Integração com o fluxo de pedidos e impressão do iMenu",
                    ]}
                />
                <BlogCallout title="Quando o iMenu faz mais sentido" variant="tip">
                    Para restaurantes que querem testar autoatendimento por QR Code com um custo
                    fixo muito baixo e sem trocar toda a operação por um novo PDV.
                </BlogCallout>
                <p>
                    Quer entender o fluxo completo antes de escolher? Veja o guia de{" "}
                    <Link
                        href="/blog/cardapio-digital-qr-code-restaurante"
                        className="font-semibold text-brand underline"
                    >
                        cardápio digital com QR Code para restaurante
                    </Link>
                    .
                </p>
            </BlogSection>

            <BlogSection id="goomer" title="2. Goomer: forte em autoatendimento e integração com o salão">
                <p>
                    A Goomer é uma das plataformas mais conhecidas de autoatendimento para
                    restaurantes. Na solução de Cardápio Digital em QR Code, o restaurante
                    cadastra as mesas e gera códigos exclusivos para cada uma. O cliente abre o
                    cardápio, faz o pedido no celular e a operação pode enviar os pedidos para a
                    cozinha por monitor ou impressora.
                </p>
                <p>
                    A própria Goomer também destaca integração com PDV, uso do QR na mesa,
                    balcão ou como comanda digital e recursos voltados a operações que querem
                    centralizar diferentes pontos de atendimento.
                </p>
                <p>
                    Fonte consultada:{" "}
                    <a
                        href="https://goomer.com.br/cardapio-digital-qr-code"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        Cardápio Digital em QR Code da Goomer
                    </a>
                    .
                </p>
                <BlogCallout title="Quando a Goomer faz mais sentido" variant="info">
                    Para restaurantes que valorizam uma solução de autoatendimento mais ampla e
                    integração com uma operação de salão já estruturada.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="anota-ai" title="3. Anota AI: QR Code para mesa junto da automação de atendimento">
                <p>
                    A Anota AI oferece QR Codes únicos por mesa. O cliente escaneia, acessa o
                    cardápio digital e pode completar o pedido sem esperar o garçom. O recurso
                    está inserido em uma plataforma mais ampla que também trabalha com
                    atendente virtual, WhatsApp, PDV, fidelidade, impressão e gerenciamento de
                    pedidos.
                </p>
                <p>
                    Isso torna a Anota AI especialmente interessante quando o restaurante não
                    está procurando apenas um QR Code, mas também quer automatizar outros
                    canais de atendimento. A página pública do recurso oferece teste grátis por
                    sete dias e direciona o preço para contato comercial.
                </p>
                <p>
                    Fonte consultada:{" "}
                    <a
                        href="https://anota.ai/home/funcionalidade/qr-code/"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        QR Code para mesas da Anota AI
                    </a>
                    .
                </p>
                <BlogCallout title="Quando a Anota AI faz mais sentido" variant="info">
                    Para operações que querem juntar autoatendimento na mesa com uma estratégia
                    forte de automação no WhatsApp e outros canais.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="saipos" title="4. Saipos: QR Code integrado ao sistema de gestão">
                <p>
                    A Saipos oferece duas modalidades de Cardápio Digital QR Code. Na versão de
                    visualização, o cliente consulta o menu e o garçom continua lançando o
                    pedido. Na versão com pedido online, o próprio cliente envia o pedido e ele
                    segue para as comandas de cozinha.
                </p>
                <p>
                    Segundo a página pública da Saipos, o cardápio digital não tem custo
                    adicional além da mensalidade do sistema de gestão. Por isso, a solução é
                    particularmente lógica para um restaurante que já usa Saipos e quer manter
                    mesas, comandas, cozinha e gestão no mesmo ecossistema.
                </p>
                <p>
                    Fontes consultadas:{" "}
                    <a
                        href="https://saipos.com/cardapio-digital"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        Cardápio Digital Saipos
                    </a>{" "}
                    e{" "}
                    <a
                        href="https://meajuda.saipos.com/hc/pt-br/articles/20211394475540-Card%C3%A1pio-Digital-QR-Code-na-Saipos"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        documentação do QR Code
                    </a>
                    .
                </p>
                <BlogCallout title="Quando a Saipos faz mais sentido" variant="info">
                    Para restaurantes que já usam o sistema Saipos ou querem que o QR Code seja
                    apenas uma parte de uma plataforma maior de gestão e PDV.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="como-escolher" title="Como escolher o melhor QR Code para o seu restaurante">
                <BlogSubheading>1. Veja se o QR apenas mostra o menu ou também recebe pedido</BlogSubheading>
                <p>
                    Esse é o filtro mais importante. Se o objetivo é reduzir espera no salão,
                    apenas abrir um PDF não resolve o principal gargalo. Procure um fluxo que
                    permita selecionar itens, adicionais e enviar o pedido.
                </p>

                <BlogSubheading>2. Confira como a mesa é identificada</BlogSubheading>
                <p>
                    QR Codes individuais eliminam uma etapa porque a mesa já vem definida. Um
                    QR universal facilita a impressão e pode ser útil como código de apoio, mas
                    exige que o cliente escolha a mesa.
                </p>

                <BlogSubheading>3. Some o custo total, não apenas o módulo de QR Code</BlogSubheading>
                <p>
                    Algumas plataformas vendem o QR dentro de um sistema completo; outras
                    permitem contratar apenas a função necessária. Compare mensalidade, PDV,
                    integrações, implantação e o que você realmente vai usar.
                </p>

                <BlogSubheading>4. Teste o pedido em um horário real de operação</BlogSubheading>
                <p>
                    Faça o caminho completo: scan, abertura do cardápio, adicionais, envio,
                    identificação da mesa e chegada à cozinha. O melhor sistema é o que continua
                    simples quando o salão está cheio.
                </p>

                <BlogChecklist
                    items={[
                        "Abre rápido no celular sem instalar aplicativo",
                        "Permite pedido, não apenas visualização",
                        "Identifica a mesa de forma clara",
                        "Aceita vários clientes na mesma mesa",
                        "Pedido chega ao painel ou cozinha sem redigitação",
                        "Preço cabe no volume real do restaurante",
                    ]}
                />
            </BlogSection>
        </BlogArticle>
    );
}

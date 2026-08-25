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
            "Para quem quer receber pedidos identificados por mesa gastando pouco, o iMenu se destaca pelo preço: R$ 5,00 por mês. Na comparação consultada em agosto de 2026, o Goomer parte de R$ 99,90 por mês no plano mensal de QR Code, a oferta pública do Anota AI aparece por R$ 99,99 por mês no checkout promocional e a Saipos parte de R$ 240,79 por mês no sistema de gestão.",
    },
    {
        question: "Qual é o QR Code para restaurante mais barato entre iMenu, Goomer, Anota AI e Saipos?",
        answer:
            "Entre as quatro opções comparadas, o iMenu QR Code Mesa é o mais barato: R$ 5,00 por mês. O Goomer parte de R$ 99,90 por mês no plano mensal de QR Code, o checkout promocional do Anota AI mostra R$ 99,99 por mês e a Saipos parte de R$ 240,79 por mês.",
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
            "O iMenu QR Code Mesa custa R$ 5,00 por mês, com cobrança mensal no cartão e cancelamento quando quiser. O restante do iMenu continua grátis para sempre e sem limites.",
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
                "Preços publicados, condições de contratação e diferenças reais de custo",
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
                    A lista foi revisada em agosto de 2026 usando preços e condições publicados
                    pelas próprias plataformas. Como este conteúdo é publicado pelo iMenu,
                    deixamos os números e as fontes explícitos para você comparar custo,
                    compromisso de contratação e recursos por conta própria.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            position: "1",
                            name: "iMenu QR Code Mesa",
                            bestFor: "Melhor custo-benefício",
                            description:
                                "R$ 5,00/mês, cancele quando quiser. O iMenu principal continua grátis para sempre e sem limites, com cardápio online e recursos para receber e gerenciar pedidos.",
                        },
                        {
                            position: "2",
                            name: "Goomer",
                            bestFor: "Boa operação de salão, preço bem maior",
                            description:
                                "QR Code a R$ 99,90/mês no plano mensal básico — cerca de 20x o preço do iMenu QR Code Mesa. Plano anual: 12x de R$ 59,94.",
                        },
                        {
                            position: "3",
                            name: "Anota AI",
                            bestFor: "Muitos recursos, atenção às condições",
                            description:
                                "Checkout promocional consultado mostra R$ 99,99/mês e fidelidade mínima de 12 meses. A página principal também anuncia 'sem fidelidade', então vale confirmar a condição antes de contratar.",
                        },
                        {
                            position: "4",
                            name: "Saipos",
                            bestFor: "Gestão completa para quem já precisa de um PDV",
                            description:
                                "O QR Code não tem adicional, mas exige o sistema Saipos, cujos planos começam em R$ 240,79/mês — cerca de 48x o preço do iMenu QR Code Mesa.",
                        },
                    ].map((item) => (
                        <div
                            key={item.name}
                            className={`rounded-2xl border p-5 ${
                                item.position === "1"
                                    ? "border-brand/30 bg-orange-50/60 shadow-sm"
                                    : "border-gray-200 bg-white"
                            }`}
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

                <BlogCallout title="A diferença de preço é grande" variant="tip">
                    Considerando os valores mensais publicados consultados, o Goomer básico e a
                    oferta promocional do Anota AI ficam em torno de 20 vezes o valor do iMenu
                    QR Code Mesa. A mensalidade inicial da Saipos fica em torno de 48 vezes.
                    Para quem quer apenas transformar a mesa em um ponto de pedido, isso pesa
                    bastante no custo fixo.
                </BlogCallout>
            </BlogSection>

            <BlogSection id="comparativo" title="Comparativo rápido: iMenu, Goomer, Anota AI e Saipos">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full table-fixed text-left text-xs sm:text-sm">
                        <colgroup>
                            <col className="w-[30%]" />
                            <col className="w-[42%]" />
                            <col className="w-[28%]" />
                        </colgroup>
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-3 py-3 font-bold sm:px-5 sm:py-4">Sistema</th>
                                <th className="px-3 py-3 font-bold sm:px-5 sm:py-4">Preço</th>
                                <th className="px-3 py-3 font-bold sm:px-5 sm:py-4">Vs. iMenu</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr className="bg-orange-50/70">
                                <td className="px-3 py-3 font-bold text-gray-950 sm:px-5 sm:py-4">
                                    iMenu
                                    <span
                                        className="ml-1.5 text-brand"
                                        aria-label="Melhor custo-benefício"
                                        title="Melhor custo-benefício"
                                    >
                                        ★
                                    </span>
                                </td>
                                <td className="px-3 py-3 font-bold text-brand sm:px-5 sm:py-4">R$ 5,00/mês</td>
                                <td className="px-3 py-3 font-bold text-brand sm:px-5 sm:py-4">1x</td>
                            </tr>
                            <tr>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">Goomer</td>
                                <td className="px-3 py-3 sm:px-5 sm:py-4">
                                    <strong>R$ 99,90/mês</strong><br />
                                    <span className="text-[11px] text-gray-500 sm:text-xs">ou 12x de R$ 59,94 no anual</span>
                                </td>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">≈ 20x</td>
                            </tr>
                            <tr>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">Anota AI</td>
                                <td className="px-3 py-3 sm:px-5 sm:py-4">
                                    <strong>R$ 99,99/mês</strong><br />
                                    <span className="text-[11px] text-gray-500 sm:text-xs">oferta do checkout consultado</span>
                                </td>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">≈ 20x</td>
                            </tr>
                            <tr>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">Saipos</td>
                                <td className="px-3 py-3 sm:px-5 sm:py-4">
                                    <strong>R$ 240,79/mês</strong><br />
                                    <span className="text-[11px] text-gray-500 sm:text-xs">a partir de</span>
                                </td>
                                <td className="px-3 py-3 font-semibold text-gray-950 sm:px-5 sm:py-4">≈ 48x</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-sm leading-6 text-gray-500">
                    Valores consultados nas páginas públicas das próprias empresas em agosto de
                    2026. Promoções, planos anuais e condições comerciais podem mudar.
                </p>
            </BlogSection>

            <BlogSection id="imenu" title="1. iMenu QR Code Mesa: melhor custo-benefício para começar">
                <p>
                    O <strong>iMenu QR Code Mesa custa R$ 5,00 por mês</strong>. A cobrança é
                    mensal no cartão e você pode cancelar quando quiser. Não é necessário
                    contratar um PDV completo só para colocar pedidos por QR Code nas mesas.
                </p>
                <p>
                    O restante do iMenu continua <strong>grátis para sempre e sem limites</strong>,
                    com cardápio online e todos os recursos para receber e gerenciar pedidos. O
                    QR Code Mesa entra como um adicional barato para quem quer transformar cada
                    mesa em um novo ponto de pedido.
                </p>
                <p>
                    O restaurante pode gerar um QR Code individual para cada mesa ou usar um QR
                    universal, em que o cliente escolhe a mesa ao entrar. Depois do scan, o pedido
                    é feito no mesmo cardápio e chega identificado no painel e na impressão.
                </p>
                <BlogChecklist
                    items={[
                        "R$ 5,00 por mês",
                        "Cancele quando quiser",
                        "Cardápio digital principal grátis para sempre e sem limites",
                        "QR Code individual por mesa",
                        "QR Code universal como alternativa",
                        "Vários clientes podem pedir ao mesmo tempo na mesma mesa",
                        "Mesa identificada no painel e na impressão",
                        "Sem endereço ou pedido mínimo para pedidos de mesa",
                    ]}
                />
                <BlogCallout title="O ponto forte do iMenu é simples" variant="tip">
                    Você não precisa pagar R$ 100, R$ 200 ou mais por mês apenas para colocar
                    autoatendimento na mesa. O QR Code Mesa custa R$ 5,00/mês e aproveita o
                    cardápio e a estrutura de pedidos que você já tem no iMenu.
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

            <BlogSection id="goomer" title="2. Goomer: bom autoatendimento, mas custa bem mais">
                <p>
                    A Goomer oferece uma solução sólida de QR Code para restaurante. O plano
                    Básico de QR Code custa <strong>R$ 99,90 por mês</strong> no mensal ou
                    <strong> 12x de R$ 59,94</strong> no plano anual. Ele permite foto de
                    produtos, opcionais, identidade visual e cardápio com visualização ou pedido.
                </p>
                <p>
                    Para recursos operacionais mais completos, o preço sobe. O plano Automatizar
                    de QR Code custa <strong>R$ 184,90/mês</strong> no mensal ou 12x de
                    R$ 138,68 no anual e adiciona, entre outros recursos, gestor de pedidos,
                    impressão e gestor de cozinha. O plano Integrar chega a R$ 299,90/mês no
                    preço mensal publicado.
                </p>
                <BlogCallout title="Ponto de atenção: até o plano de entrada custa cerca de 20x mais" variant="info">
                    Comparando mensalidade com mensalidade, R$ 99,90 é aproximadamente 20 vezes
                    os R$ 5,00 do iMenu QR Code Mesa. Se o restaurante só quer receber pedidos
                    identificados por mesa, a diferença de custo é grande.
                </BlogCallout>
                <p>
                    Fonte consultada:{" "}
                    <a
                        href="https://goomer.com.br/planos"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        Planos e preços da Goomer
                    </a>
                    .
                </p>
            </BlogSection>

            <BlogSection id="anota-ai" title="3. Anota AI: muitos recursos, mas confira a condição de contratação">
                <p>
                    O Anota AI inclui QR Code para mesas no conjunto de recursos do plano Start,
                    junto de robô com IA, cardápio digital, PDV, app para garçom, pagamento
                    online, cupons, cashback e outros recursos.
                </p>
                <p>
                    No checkout público consultado, o plano Start aparece em promoção de
                    <strong> R$ 299,99 por R$ 99,99/mês</strong> e informa
                    <strong> fidelidade mínima de 12 meses</strong>. Isso representa cerca de
                    R$ 1.199,88 ao longo de 12 meses se a condição promocional permanecer igual
                    durante o período.
                </p>
                <BlogCallout title="Ponto de atenção: as páginas públicas mostram condições diferentes" variant="info">
                    O checkout promocional consultado informa fidelidade mínima de 12 meses,
                    enquanto a página principal do Anota AI também exibe “sem fidelidade”. Antes
                    de contratar, confirme exatamente qual condição vale para o plano e a oferta
                    que você está fechando.
                </BlogCallout>
                <p>
                    Fontes consultadas:{" "}
                    <a
                        href="https://pagamento.anota.ai/register?self_source=LP_SELF_CHECKOUT"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        checkout público do Anota AI
                    </a>{" "}
                    e{" "}
                    <a
                        href="https://anota.ai/home/"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        página principal do Anota AI
                    </a>
                    .
                </p>
            </BlogSection>

            <BlogSection id="saipos" title="4. Saipos: QR Code incluso, mas dentro de um sistema completo de gestão">
                <p>
                    A Saipos informa que o Cardápio Digital QR Code não tem custo adicional para
                    clientes do sistema. O ponto importante é o custo de entrada do próprio
                    sistema de gestão: os planos da Saipos começam em
                    <strong> R$ 240,79 por mês</strong>.
                </p>
                <p>
                    Para quem já precisa de PDV, financeiro, estoque, fiscal e integrações, isso
                    pode fazer sentido. Mas, se o objetivo é apenas colocar um QR Code na mesa e
                    receber pedidos, o custo efetivo de entrada é muito maior que o de uma
                    solução específica.
                </p>
                <BlogCallout title="Ponto de atenção: 'QR grátis' não significa sistema grátis" variant="info">
                    O módulo de QR Code não tem adicional, mas ele faz parte de uma assinatura
                    que começa em R$ 240,79/mês. Esse valor é aproximadamente 48 vezes os
                    R$ 5,00/mês do iMenu QR Code Mesa.
                </BlogCallout>
                <p>
                    Fontes consultadas:{" "}
                    <a
                        href="https://saipos.com/planos-e-precos"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        Planos e preços da Saipos
                    </a>{" "}
                    e{" "}
                    <a
                        href="https://saipos.com/cardapio-digital"
                        target="_blank"
                        rel="noreferrer"
                        className={sourceClass}
                    >
                        Cardápio Digital Saipos
                    </a>
                    .
                </p>
            </BlogSection>

            <BlogSection id="como-escolher" title="Como escolher o melhor QR Code para o seu restaurante">
                <BlogSubheading>1. Compare o custo total para ter pedidos pela mesa</BlogSubheading>
                <p>
                    Não olhe apenas para a frase “QR Code incluso”. Veja quanto você precisa
                    pagar por mês para efetivamente ter o recurso funcionando. Um módulo sem
                    adicional dentro de um sistema de R$ 240 por mês continua custando mais para
                    quem não precisa do restante do pacote.
                </p>

                <BlogSubheading>2. Veja se o QR apenas mostra o menu ou também recebe pedido</BlogSubheading>
                <p>
                    Se o objetivo é reduzir espera no salão, apenas abrir um PDF não resolve o
                    principal gargalo. Procure um fluxo que permita selecionar itens, adicionais
                    e enviar o pedido já associado à mesa.
                </p>

                <BlogSubheading>3. Confira fidelidade, plano anual e condições promocionais</BlogSubheading>
                <p>
                    Um preço promocional pode exigir 12 meses de compromisso ou mudar depois do
                    período inicial. Compare o custo mensal normal, o custo anual e a liberdade
                    para cancelar antes de decidir.
                </p>

                <BlogSubheading>4. Teste o pedido em um horário real de operação</BlogSubheading>
                <p>
                    Faça o caminho completo: scan, abertura do cardápio, adicionais, envio,
                    identificação da mesa e chegada à cozinha. O melhor sistema é o que continua
                    simples quando o salão está cheio.
                </p>

                <BlogChecklist
                    items={[
                        "Preço mensal real para ter QR Code com pedidos",
                        "Fidelidade ou compromisso mínimo",
                        "Permite pedido, não apenas visualização",
                        "Identifica a mesa de forma clara",
                        "Aceita vários clientes na mesma mesa",
                        "Pedido chega ao painel ou cozinha sem redigitação",
                    ]}
                />
            </BlogSection>
        </BlogArticle>
    );
}

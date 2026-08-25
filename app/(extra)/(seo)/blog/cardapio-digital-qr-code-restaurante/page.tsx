import Link from "next/link";
import { faQrcode } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("cardapio-digital-qr-code-restaurante")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é" },
    { id: "como-funciona", label: "Como funciona" },
    { id: "menu-ou-pedido", label: "Menu x pedido pela mesa" },
    { id: "qr-por-mesa", label: "QR por mesa" },
    { id: "vantagens", label: "Vantagens" },
    { id: "como-criar", label: "Como criar" },
    { id: "preco", label: "Preço" },
    { id: "boas-praticas", label: "Boas práticas" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como funciona um cardápio digital com QR Code no restaurante?",
        answer:
            "O cliente aponta a câmera do celular para o QR Code, abre o cardápio online e consulta produtos, preços, adicionais e disponibilidade. Quando o sistema também aceita pedidos pela mesa, o cliente monta o pedido no próprio celular e o restaurante recebe tudo identificado com a mesa.",
    },
    {
        question: "Precisa instalar aplicativo para usar QR Code na mesa?",
        answer:
            "Não. No iMenu, o cliente acessa o cardápio pelo navegador do celular. Basta escanear o QR Code ou abrir o link.",
    },
    {
        question: "Cada mesa precisa ter um QR Code diferente?",
        answer:
            "Não obrigatoriamente. O iMenu permite usar um QR Code individual por mesa ou um QR Code universal, no qual o cliente escolhe a mesa ao abrir o cardápio.",
    },
    {
        question: "Mais de uma pessoa pode pedir usando o mesmo QR Code da mesa?",
        answer:
            "Sim. Vários clientes podem usar o mesmo QR Code e enviar pedidos pela mesma mesa. O sistema não limita o uso a uma única pessoa por mesa.",
    },
    {
        question: "Quanto custa o QR Code para pedidos na mesa no iMenu?",
        answer:
            "O cardápio digital do iMenu é grátis para sempre, sem limites. O recurso iMenu QR Code Mesa custa R$ 5,00 por mês, com cobrança mensal no cartão e cancelamento quando quiser.",
    },
    {
        question: "O cliente paga pelo QR Code da mesa?",
        answer:
            "No fluxo atual do iMenu QR Code Mesa, o QR Code é usado para abrir o cardápio e enviar o pedido identificado com a mesa. O pagamento não faz parte dessa etapa.",
    },
];

export default function CardapioDigitalQrCodeRestaurantePage() {
    return (
        <BlogArticle
            article={article}
            icon={faQrcode}
            takeaways={[
                "A diferença entre um QR Code que só abre o cardápio e um que também recebe pedidos",
                "Como usar QR Code individual por mesa ou um QR Code universal",
                "Um passo a passo para colocar pedidos pela mesa para funcionar no restaurante",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "controle-estoque-cardapio-digital",
                "robo-whatsapp-para-restaurante",
                "como-aumentar-ticket-medio-restaurante",
            ]}
            ctaTitle="Crie seu cardápio digital grátis e transforme cada mesa em um ponto de pedido"
        >
            <figure className="overflow-hidden rounded-3xl border border-orange-100 bg-orange-50/40 shadow-sm">
                <img
                    src="/images/QRCodeMesa.png"
                    alt="Cliente usando o celular para escanear um QR Code na mesa do restaurante"
                    className="block h-auto w-full"
                />
            </figure>

            <BlogSection
                id="o-que-e"
                title="O que é um cardápio digital com QR Code para restaurante?"
            >
                <p>
                    Um <strong>cardápio digital com QR Code</strong> é um menu online que o
                    cliente abre pelo celular ao escanear um código impresso na mesa, no
                    balcão, na embalagem ou em qualquer outro ponto do restaurante. Em vez
                    de depender de um cardápio físico, o cliente vê os produtos, preços,
                    fotos, descrições e adicionais diretamente no navegador.
                </p>
                <p>
                    Mas existem dois usos bem diferentes para o mesmo QR Code. O primeiro
                    apenas abre o cardápio. O segundo transforma o celular em um ponto de
                    pedido: o cliente escolhe os itens e envia o pedido para o restaurante
                    sem precisar esperar alguém anotar.
                </p>
                <BlogCallout title="O QR Code é só a porta de entrada" variant="tip">
                    O valor real está no que acontece depois do scan. Um bom sistema deve
                    abrir rápido, funcionar bem no celular e levar o cliente da consulta ao
                    pedido sem criar etapas desnecessárias.
                </BlogCallout>
                <p>
                    Se você ainda está começando, veja também como funciona um{" "}
                    <Link
                        href="/cardapio-digital-gratuito"
                        className="font-semibold text-brand underline"
                    >
                        cardápio digital gratuito para restaurante
                    </Link>
                    . A lógica é a mesma: o cardápio fica online e pode ser acessado por link
                    ou QR Code.
                </p>
            </BlogSection>

            <BlogSection
                id="como-funciona"
                title="Como funciona o QR Code na mesa do restaurante"
            >
                <BlogSteps
                    items={[
                        {
                            title: "O cliente escaneia o QR Code",
                            description:
                                "A câmera do celular reconhece o código e abre o cardápio digital no navegador, sem exigir instalação de aplicativo.",
                        },
                        {
                            title: "O sistema identifica a mesa",
                            description:
                                "Com um QR individual, a mesa já vem identificada. Com o QR universal, o cliente escolhe a mesa ao abrir.",
                        },
                        {
                            title: "Cada pessoa escolhe o que quer",
                            description:
                                "Vários clientes podem abrir o mesmo QR Code, navegar pelo cardápio e montar pedidos ao mesmo tempo.",
                        },
                        {
                            title: "O pedido é enviado",
                            description:
                                "Os itens escolhidos chegam ao painel já associados à mesa, sem pedir endereço de entrega ou pedido mínimo de delivery.",
                        },
                        {
                            title: "A equipe acompanha no painel",
                            description:
                                "A identificação da mesa aparece junto do pedido e também pode seguir para a impressão da operação.",
                        },
                    ]}
                />
                <p>
                    Esse modelo é especialmente útil em restaurante, pizzaria, hamburgueria,
                    bar, cafeteria, lanchonete e qualquer operação em que o cliente permanece
                    em uma mesa e pode querer fazer mais de um pedido durante a visita.
                </p>
            </BlogSection>

            <BlogSection
                id="menu-ou-pedido"
                title="QR Code para cardápio ou QR Code para fazer pedido: qual a diferença?"
            >
                <p>
                    É comum procurar por <strong>“QR Code para cardápio”</strong> e encontrar
                    soluções que fazem apenas uma coisa: abrir um PDF ou uma página com os
                    produtos. Isso já elimina parte do papel, mas o processo de atendimento
                    continua praticamente igual. O cliente ainda precisa chamar alguém para
                    pedir.
                </p>
                <p>
                    Já um <strong>cardápio digital com pedidos pela mesa</strong> conecta o
                    menu ao sistema de pedidos. O cliente não só consulta: ele seleciona os
                    itens e envia a solicitação pelo próprio celular.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Recurso</th>
                                <th className="px-5 py-4 font-bold">QR que só abre o menu</th>
                                <th className="px-5 py-4 font-bold">QR com pedidos pela mesa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Ver produtos e preços</td>
                                <td className="px-5 py-4">Sim</td>
                                <td className="px-5 py-4">Sim</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Escolher adicionais</td>
                                <td className="px-5 py-4">Depende do cardápio</td>
                                <td className="px-5 py-4">Sim, quando configurados</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Enviar pedido pelo celular</td>
                                <td className="px-5 py-4">Não</td>
                                <td className="px-5 py-4">Sim</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Identificar a mesa</td>
                                <td className="px-5 py-4">Não</td>
                                <td className="px-5 py-4">Sim</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Pedido chega ao painel</td>
                                <td className="px-5 py-4">Não</td>
                                <td className="px-5 py-4">Sim</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogCallout title="Não confunda QR Code com PDF" variant="info">
                    Um PDF pode ser acessado por QR Code, mas não oferece a mesma experiência
                    de um cardápio online responsivo, atualizado e conectado ao pedido.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="qr-por-mesa"
                title="QR Code por mesa ou QR Code universal?"
            >
                <BlogSubheading>QR Code individual por mesa</BlogSubheading>
                <p>
                    Cada mesa recebe um código próprio. Quando o cliente escaneia, o sistema
                    já sabe de onde aquele pedido está vindo. É a opção mais direta quando o
                    restaurante tem mesas numeradas e quer reduzir qualquer chance de o
                    cliente selecionar a mesa errada.
                </p>
                <BlogSubheading>QR Code universal</BlogSubheading>
                <p>
                    Um único código pode ser usado em diferentes pontos do salão. Ao abrir,
                    o cliente informa qual mesa está usando. Isso é útil para começar rápido,
                    imprimir menos materiais ou manter um QR de apoio no balcão e em placas.
                </p>
                <BlogChecklist
                    items={[
                        "Use QR individual quando as mesas já têm numeração fixa",
                        "Use QR universal como opção simples para começar ou como código de apoio",
                        "Imprima o número da mesa junto do QR individual para facilitar conferência",
                        "Teste cada código antes de plastificar ou produzir material em quantidade",
                        "Mantenha o QR em uma área plana e fácil de alcançar com a câmera",
                        "Evite colocar o código em superfície muito brilhante ou com baixo contraste",
                    ]}
                />
            </BlogSection>

            <BlogSection
                id="vantagens"
                title="Vantagens do cardápio digital com pedidos direto da mesa"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        [
                            "Menos espera para pedir",
                            "O cliente pode abrir o cardápio assim que senta e enviar o pedido quando estiver pronto, sem depender do momento em que alguém da equipe chega à mesa.",
                        ],
                        [
                            "Mais autonomia para o cliente",
                            "Cada pessoa consulta o cardápio no próprio celular, vê adicionais e decide no próprio ritmo.",
                        ],
                        [
                            "Mesa identificada automaticamente",
                            "O pedido chega com a referência da mesa, reduzindo a necessidade de a equipe digitar essa informação manualmente.",
                        ],
                        [
                            "Vários pedidos na mesma mesa",
                            "Mais de uma pessoa pode usar o mesmo QR Code. A mesa não fica presa a um único celular ou cliente.",
                        ],
                        [
                            "Cardápio sempre atualizado",
                            "Alterações feitas no cardápio online aparecem no mesmo QR Code, sem precisar imprimir um novo código a cada mudança de preço ou item.",
                        ],
                        [
                            "Integração com a operação",
                            "O pedido entra no painel e a identificação da mesa pode seguir para a impressão, mantendo o fluxo organizado.",
                        ],
                    ].map(([title, description]) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-gray-200 bg-white p-5"
                        >
                            <h3 className="font-bold text-gray-950">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
                <p>
                    O objetivo não é eliminar o atendimento humano. É tirar da equipe a
                    obrigação de estar presente em toda etapa mecânica do pedido. Garçom e
                    atendente continuam importantes para recepção, dúvidas, entrega dos itens
                    e situações fora do padrão.
                </p>
            </BlogSection>

            <BlogSection
                id="como-criar"
                title="Como criar um cardápio digital com QR Code para mesas"
            >
                <BlogSteps
                    items={[
                        {
                            title: "Crie o cardápio online",
                            description:
                                "Cadastre categorias, produtos, preços, fotos e adicionais. No iMenu, o cardápio digital principal é grátis para sempre e sem limites.",
                        },
                        {
                            title: "Revise o cardápio no celular",
                            description:
                                "Abra como cliente e confirme se nomes, preços, opções e disponibilidade estão claros antes de colocar o QR nas mesas.",
                        },
                        {
                            title: "Ative pedidos por mesa",
                            description:
                                "No painel do iMenu, abra Mesas e ative o iMenu QR Code Mesa para habilitar o fluxo de consumo no local.",
                        },
                        {
                            title: "Cadastre ou organize as mesas",
                            description:
                                "Use a identificação que já existe no salão para facilitar a leitura pela equipe e a conferência do pedido.",
                        },
                        {
                            title: "Gere os QR Codes",
                            description:
                                "Escolha QR Codes individuais por mesa ou comece com o QR universal para o cliente selecionar a mesa.",
                        },
                        {
                            title: "Faça um pedido de teste",
                            description:
                                "Escaneie com outro celular, envie itens e confirme se a mesa aparece corretamente no painel e na impressão usada pela operação.",
                        },
                    ]}
                />
                <p>
                    Se você ainda não usa o iMenu, pode começar pelo guia com os{" "}
                    <Link
                        href="/cardapio-digital"
                        className="font-semibold text-brand underline"
                    >
                        melhores cardápios digitais grátis
                    </Link>{" "}
                    e comparar o que realmente precisa antes de escolher uma solução.
                </p>
            </BlogSection>

            <BlogSection id="preco" title="Quanto custa um cardápio digital com QR Code na mesa?">
                <p>
                    O preço varia bastante entre plataformas porque algumas cobram pelo
                    cardápio, outras por pedidos, usuários, módulos ou número de mesas. Por
                    isso, compare exatamente o recurso que você vai usar.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="text-sm font-semibold text-brand">Cardápio digital iMenu</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">Grátis para sempre</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Sem limites, com cardápio online e todos os recursos para receber
                            e gerenciar pedidos.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5">
                        <p className="text-sm font-semibold text-brand">iMenu QR Code Mesa</p>
                        <p className="mt-2 text-2xl font-bold text-gray-950">R$ 5,00/mês</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Cobrança mensal no cartão. Cancele quando quiser. Inclui pedidos
                            identificados por mesa, QR individual e QR universal.
                        </p>
                    </div>
                </div>
                <BlogCallout title="Compare custo com fricção, não só com mensalidade" variant="tip">
                    Um sistema barato que só abre um PDF resolve um problema diferente de um
                    sistema que recebe pedidos e identifica a mesa. Compare o fluxo completo
                    que o cliente e a equipe realmente vão usar.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="boas-praticas"
                title="Boas práticas para o QR Code funcionar bem no salão"
            >
                <BlogSubheading>Deixe uma instrução curta ao lado do código</BlogSubheading>
                <p>
                    Algo como <strong>“Escaneie para ver o cardápio e pedir”</strong> já deixa
                    claro o que acontece. Evite textos longos antes do cliente chegar ao menu.
                </p>
                <BlogSubheading>Não esconda o número da mesa</BlogSubheading>
                <p>
                    Mesmo com identificação automática, mostrar o número fisicamente ajuda o
                    cliente e a equipe a conferirem se estão falando da mesma mesa.
                </p>
                <BlogSubheading>Teste em celulares diferentes</BlogSubheading>
                <p>
                    Antes de imprimir em quantidade, teste câmera, abertura do link, navegação,
                    adicionais, envio do pedido e retorno ao cardápio em mais de um aparelho.
                </p>
                <BlogSubheading>Mantenha uma alternativa de atendimento</BlogSubheading>
                <p>
                    Alguns clientes preferem pedir com uma pessoa ou podem estar sem bateria,
                    internet ou câmera funcionando. O QR Code deve acelerar o atendimento, não
                    virar uma barreira obrigatória.
                </p>
                <BlogChecklist
                    items={[
                        "QR Code grande o suficiente para leitura confortável",
                        "Bom contraste entre código e fundo",
                        "Link abrindo em HTTPS e sem tela de instalação",
                        "Cardápio responsivo e rápido no celular",
                        "Preço e disponibilidade revisados antes do turno",
                        "Pedido de teste feito depois de qualquer mudança importante",
                    ]}
                />
            </BlogSection>
        </BlogArticle>
    );
}

import Link from "next/link";
import { faBellConcierge } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("aplicativo-para-garcom")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é" },
    { id: "como-funciona", label: "Como funciona" },
    { id: "recursos", label: "Principais recursos" },
    { id: "diferencas", label: "App, comanda e QR Code" },
    { id: "vantagens", label: "Vantagens no salão" },
    { id: "como-escolher", label: "Como escolher" },
    { id: "como-usar-imenu", label: "Como usar no iMenu" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como funciona um aplicativo para garçom?",
        answer:
            "O garçom abre o sistema no celular, escolhe a mesa, consulta o cardápio e registra os itens pedidos. No iMenu, o pedido fica vinculado à mesa e volta para o mesmo painel usado para acompanhar os pedidos em aberto.",
    },
    {
        question: "Qual é o melhor aplicativo para garçom?",
        answer:
            "O melhor aplicativo para garçom é o que combina com a operação do restaurante. Compare facilidade de uso no celular, controle por mesa, adicionais e observações, acompanhamento do status, integração com o cardápio e custo total. Se você já usa QR Code nas mesas, uma solução integrada evita manter dois cardápios separados.",
    },
    {
        question: "O iMenu tem aplicativo para garçom?",
        answer:
            "Sim. Restaurantes com o iMenu QR Code Mesa ativo podem acessar o Painel Garçom para visualizar mesas, acompanhar pedidos em aberto e adicionar um novo pedido diretamente na mesa.",
    },
    {
        question: "Precisa instalar o aplicativo para garçom no celular?",
        answer:
            "Não. O Painel Garçom do iMenu funciona no navegador do celular. A equipe acessa o link, entra na conta do restaurante e usa o sistema sem baixar outro aplicativo.",
    },
    {
        question: "O garçom consegue adicionar pedidos e adicionais pelo celular?",
        answer:
            "Sim. Ao tocar em Adicionar pedido, o garçom abre o cardápio da mesa, escolhe produtos, opcionais e observações e finaliza o pedido. Depois, o sistema retorna ao Painel Garçom.",
    },
    {
        question: "O App para Garçom do iMenu é gratuito?",
        answer:
            "O Painel Garçom está incluído no iMenu QR Code Mesa, que é um recurso pago. O cardápio digital principal do iMenu continua gratuito.",
    },
    {
        question: "O App para Garçom fecha a conta ou recebe o pagamento da mesa?",
        answer:
            "Não na versão atual. O Painel Garçom do iMenu serve para visualizar pedidos em aberto e adicionar pedidos vinculados à mesa. Fechamento, divisão da conta e pagamento não fazem parte desse fluxo.",
    },
];

export default function AplicativoParaGarcomPage() {
    return (
        <BlogArticle
            article={article}
            icon={faBellConcierge}
            takeaways={[
                "Como funciona um aplicativo para garçom no celular",
                "A diferença entre app do garçom, comanda eletrônica e QR Code na mesa",
                "Como visualizar mesas e adicionar pedidos usando o Painel Garçom do iMenu",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "cardapio-digital-qr-code-restaurante",
                "melhor-qr-code-mesa-restaurante",
                "controle-estoque-cardapio-digital",
            ]}
            ctaTitle="Crie seu cardápio digital e organize os pedidos do salão com o iMenu"
        >
            <BlogSection
                id="o-que-e"
                title="O que é um aplicativo para garçom?"
            >
                <p>
                    Um <strong>aplicativo para garçom</strong> é um sistema que permite
                    registrar pedidos pelo celular ou tablet enquanto o atendimento ainda
                    está acontecendo na mesa. Em vez de anotar em papel e depois repetir o
                    pedido no balcão, o garçom escolhe a mesa, seleciona os produtos e envia
                    as informações pelo próprio aparelho.
                </p>
                <p>
                    Na prática, o celular vira uma <strong>comanda eletrônica para o
                    garçom</strong>. A equipe consegue consultar o cardápio atualizado,
                    encontrar adicionais, escrever observações e conferir os pedidos que já
                    estão abertos naquela mesa.
                </p>
                <BlogCallout title="App do garçom não é a mesma coisa que garçom digital" variant="info">
                    No app para garçom, um funcionário registra o pedido. No autoatendimento
                    ou “garçom digital”, o próprio cliente lê o QR Code e faz o pedido pelo
                    celular. Os dois formatos podem funcionar juntos no mesmo restaurante.
                </BlogCallout>
                <p>
                    Essa combinação é especialmente útil quando parte dos clientes prefere
                    pedir pelo QR Code e outra parte quer atendimento tradicional. O
                    restaurante mantém o contato humano, mas usa o mesmo cardápio e a mesma
                    identificação de mesa nos dois caminhos.
                </p>
            </BlogSection>

            <BlogSection
                id="como-funciona"
                title="Como funciona um app para garçom no restaurante?"
            >
                <p>
                    O fluxo deve ser curto o suficiente para funcionar durante o movimento.
                    No iMenu, o garçom parte do painel de mesas, abre o cardápio da mesa
                    escolhida e finaliza o pedido no mesmo fluxo usado pelo QR Code Mesa.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "O garçom abre o painel no celular",
                            description:
                                "O acesso é feito pelo navegador. Não é necessário instalar outro aplicativo.",
                        },
                        {
                            title: "Seleciona a mesa correta",
                            description:
                                "Cada mesa ativa aparece em um cartão com a quantidade de pedidos em aberto.",
                        },
                        {
                            title: "Consulta o que já foi pedido",
                            description:
                                "O painel mostra número do pedido, cliente, itens, valor, horário e status.",
                        },
                        {
                            title: "Adiciona um novo pedido",
                            description:
                                "O garçom abre o cardápio da mesa, escolhe produtos, opcionais e observações e confirma.",
                        },
                        {
                            title: "Volta para o painel de mesas",
                            description:
                                "Depois da confirmação, o pedido fica vinculado à mesa e o sistema retorna ao Painel Garçom.",
                        },
                    ]}
                />
                <p>
                    Como o pedido é de mesa, o fluxo não pede endereço de entrega nem cobra
                    taxa de entrega. Pagamento, fechamento e divisão da conta também ficam
                    fora dessa etapa: o objetivo é registrar e acompanhar o consumo com
                    rapidez.
                </p>
            </BlogSection>

            <BlogSection
                id="recursos"
                title="O que um bom aplicativo de pedidos para garçom precisa ter"
            >
                <p>
                    Nem todo sistema chamado de app para garçom resolve o mesmo problema.
                    Alguns são apenas blocos de anotação digitais; outros ligam mesa,
                    cardápio e pedidos em um único fluxo. Para uso diário, estes recursos
                    fazem diferença:
                </p>
                <BlogChecklist
                    items={[
                        <><strong>Mapa de mesas:</strong> escolha clara da mesa antes de iniciar o pedido.</>,
                        <><strong>Pedidos em aberto:</strong> consulta rápida do que já foi lançado.</>,
                        <><strong>Cardápio atualizado:</strong> os mesmos produtos, preços e disponibilidade usados pelo restaurante.</>,
                        <><strong>Opcionais e observações:</strong> registro correto de tamanho, ponto, adicionais e pedidos especiais.</>,
                        <><strong>Status do pedido:</strong> identificação do que está pendente, em preparo ou pronto.</>,
                        <><strong>Uso pelo celular:</strong> tela simples, botões grandes e poucas etapas durante o atendimento.</>,
                        <><strong>Identificação automática:</strong> cada novo pedido já fica associado à mesa escolhida.</>,
                        <><strong>Acesso compartilhável:</strong> possibilidade de abrir o painel nos aparelhos usados pela equipe.</>,
                    ]}
                />
                <p>
                    No Painel Garçom do iMenu, os pedidos em aberto mostram número, nome do
                    cliente, itens, valor, horário e um dos três estados visuais:
                    <strong> Pendente</strong>, <strong>Preparando</strong> ou
                    <strong> Pronto</strong>. Pedidos concluídos ou cancelados deixam de
                    aparecer para manter o painel focado no atendimento atual.
                </p>
            </BlogSection>

            <BlogSection
                id="diferencas"
                title="Aplicativo para garçom, comanda eletrônica e QR Code: qual a diferença?"
            >
                <p>
                    Os termos aparecem juntos nas buscas, mas representam partes diferentes
                    da operação. Entender a diferença evita contratar um sistema que faz
                    menos — ou muito mais — do que o restaurante realmente precisa.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Solução</th>
                                <th className="px-5 py-4 font-bold">Quem usa</th>
                                <th className="px-5 py-4 font-bold">Função principal</th>
                                <th className="px-5 py-4 font-bold">Quando faz sentido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">App para garçom</td>
                                <td className="px-5 py-4">Equipe do salão</td>
                                <td className="px-5 py-4">Lançar e acompanhar pedidos pelo celular</td>
                                <td className="px-5 py-4">Atendimento tradicional com registro digital</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Comanda eletrônica</td>
                                <td className="px-5 py-4">Equipe e caixa</td>
                                <td className="px-5 py-4">Controlar o consumo associado a uma mesa ou cliente</td>
                                <td className="px-5 py-4">Operações que precisam acompanhar a conta aberta</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">QR Code na mesa</td>
                                <td className="px-5 py-4">Cliente</td>
                                <td className="px-5 py-4">Abrir o cardápio e, quando disponível, fazer o pedido</td>
                                <td className="px-5 py-4">Autoatendimento ou apoio ao garçom</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    No iMenu, o App para Garçom e o QR Code Mesa usam o mesmo cardápio. O
                    cliente pode pedir pelo QR Code ou o garçom pode lançar o pedido por ele,
                    sem criar produtos e preços em dois lugares diferentes. Entenda também
                    como funciona o{" "}
                    <Link
                        href="/blog/cardapio-digital-qr-code-restaurante"
                        className="font-semibold text-brand underline"
                    >
                        cardápio digital com QR Code para restaurante
                    </Link>.
                </p>
            </BlogSection>

            <BlogSection
                id="vantagens"
                title="Vantagens de receber pedidos pelo celular do garçom"
            >
                <BlogSubheading>Menos informação repetida</BlogSubheading>
                <p>
                    Quando o pedido sai do papel e entra direto no sistema, o garçom não
                    precisa reescrever ou ditar os mesmos itens no balcão. Isso reduz pontos
                    de falha e preserva adicionais e observações exatamente como foram
                    registrados.
                </p>
                <BlogSubheading>Atendimento mais rápido em horários de pico</BlogSubheading>
                <p>
                    O garçom pode iniciar um novo pedido na própria mesa. A equipe passa
                    menos tempo indo e voltando apenas para registrar informações e consegue
                    dedicar mais atenção às dúvidas e à experiência do cliente.
                </p>
                <BlogSubheading>Consulta do pedido sem depender da memória</BlogSubheading>
                <p>
                    Antes de adicionar outro item, o atendente consegue conferir os pedidos
                    em aberto, o horário, o valor e o status. Isso ajuda quando mais de um
                    garçom atende a mesma área ou quando a mesa faz pedidos em momentos
                    diferentes.
                </p>
                <BlogSubheading>Cardápio sempre igual para equipe e cliente</BlogSubheading>
                <p>
                    Uma solução integrada evita diferenças entre o cardápio visto no QR Code
                    e o usado pelo garçom. Alterações de produto, preço, opcionais e
                    disponibilidade passam a valer no mesmo fluxo.
                </p>
                <BlogCallout title="Tecnologia deve apoiar o atendimento" variant="tip">
                    O objetivo não é afastar o garçom da mesa. É retirar a parte repetitiva
                    do processo para que a equipe tenha mais tempo para orientar, sugerir e
                    resolver situações que realmente precisam de contato humano.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="como-escolher"
                title="Como escolher o melhor app para garçom"
            >
                <p>
                    Antes de contratar, teste a rotina completa em um celular comum. Uma
                    lista grande de recursos não compensa um fluxo lento no meio do salão.
                    Avalie o que acontece desde a escolha da mesa até a chegada do pedido ao
                    painel do restaurante.
                </p>
                <BlogChecklist
                    items={[
                        "O garçom consegue aprender o fluxo em poucos minutos?",
                        "A tela funciona bem no celular que a equipe já possui?",
                        "É fácil confirmar a mesa antes de enviar o pedido?",
                        "Produtos, opcionais e observações aparecem corretamente?",
                        "Os pedidos em aberto e seus status são fáceis de consultar?",
                        "O sistema usa o mesmo cardápio do QR Code e do delivery?",
                        "Há cobrança separada por aparelho ou por garçom?",
                        "O recurso resolve apenas pedidos ou também promete caixa e pagamento?",
                    ]}
                />
                <p>
                    Também confirme o escopo. Se o restaurante precisa fechar conta,
                    transferir itens, dividir pagamento, emitir documento fiscal ou operar
                    sem internet, essas funções devem ser verificadas separadamente. O App
                    para Garçom do iMenu, na versão atual, é focado em visualizar mesas e
                    pedidos em aberto e adicionar novos pedidos.
                </p>
            </BlogSection>

            <BlogSection
                id="como-usar-imenu"
                title="Como usar o App para Garçom do iMenu"
            >
                <p>
                    O Painel Garçom está disponível para restaurantes com o
                    <strong> iMenu QR Code Mesa ativo</strong>. Ele abre no navegador e pode
                    ser usado nos celulares da equipe.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Ative o iMenu QR Code Mesa",
                            description:
                                "O Painel Garçom faz parte desse recurso. O cardápio digital principal continua gratuito.",
                        },
                        {
                            title: "Cadastre as mesas",
                            description:
                                "No painel do restaurante, abra Mesas e crie as mesas que serão atendidas.",
                        },
                        {
                            title: "Abra o Painel Garçom",
                            description:
                                "Em Mesas, toque em Painel Garçom. O sistema abre uma nova aba com as mesas ativas.",
                        },
                        {
                            title: "Compartilhe o acesso com a equipe",
                            description:
                                "Use o ícone de link para copiar o endereço. Cada aparelho precisa entrar na conta do restaurante.",
                        },
                        {
                            title: "Adicione o pedido na mesa correta",
                            description:
                                "Toque em Adicionar pedido, selecione os itens e confirme. Ao finalizar, você volta para o painel.",
                        },
                    ]}
                />
                <BlogCallout title="Se um pedido novo ainda não apareceu" variant="warning">
                    Atualize a página do Painel Garçom para carregar as informações mais
                    recentes. Pedidos finalizados ou cancelados não aparecem entre os
                    pedidos em aberto.
                </BlogCallout>
                <p>
                    Para começar pelo autoatendimento, você também pode comparar as opções no
                    guia sobre o{" "}
                    <Link
                        href="/blog/melhor-qr-code-mesa-restaurante"
                        className="font-semibold text-brand underline"
                    >
                        melhor QR Code para restaurante
                    </Link>.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

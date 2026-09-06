import { faTruck } from "@fortawesome/free-solid-svg-icons";

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

const article = getBlogArticle("taxa-de-entrega-por-bairro")!;

export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é" },
    { id: "como-calcular", label: "Como calcular" },
    { id: "bairro-ou-km", label: "Bairro ou KM" },
    { id: "como-configurar", label: "Como configurar" },
    { id: "endereco", label: "Como o endereço é identificado" },
    { id: "frete-gratis", label: "Frete grátis com regra" },
    { id: "erros", label: "Erros comuns" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Como calcular taxa de entrega por bairro?",
        answer:
            "Use o custo real de atender cada região como referência: valor pago ao entregador, distância, tempo de deslocamento, retorno, trânsito e dificuldade da rota. Depois agrupe bairros com custos parecidos e revise os valores com os pedidos reais.",
    },
    {
        question: "É melhor cobrar entrega por bairro ou por quilômetro?",
        answer:
            "Depende da operação. Por bairro funciona bem quando o restaurante atende regiões conhecidas e quer valores previsíveis. Por quilômetro tende a ser mais flexível quando os endereços variam muito.",
    },
    {
        question: "O iMenu permite definir uma taxa diferente para cada bairro?",
        answer:
            "Sim. No modo Entrega por Bairro, cada regra pode ter bairro, cidade, UF, tempo estimado e taxa de entrega próprios.",
    },
    {
        question: "O que acontece se o bairro do cliente não estiver cadastrado?",
        answer:
            "No modo por bairro, o endereço precisa corresponder a uma regra válida. Se não houver correspondência, o checkout não deve inventar uma taxa; o cliente pode ser orientado a conferir o nome do bairro.",
    },
    {
        question: "Posso voltar a cobrar por quilômetro depois?",
        answer:
            "Sim. O restaurante pode alternar entre Entrega por KM e Entrega por Bairro nas configurações de Tempo e Taxa.",
    },
];

export default function TaxaEntregaPorBairroPage() {
    return (
        <BlogArticle
            article={article}
            icon={faTruck}
            takeaways={[
                "Um método prático para definir taxa por bairro sem copiar o concorrente no escuro",
                "Quando cobrança por bairro faz mais sentido do que cobrança por distância",
                "Como configurar bairros, prazos e valores no iMenu",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "promocoes-para-delivery",
                "como-montar-cardapio-delivery",
                "como-vender-delivery-pelo-whatsapp",
            ]}
            ctaTitle="Configure sua área de entrega e cobre a taxa certa em cada pedido"
        >
            <BlogSection
                id="o-que-e"
                title="O que é taxa de entrega por bairro?"
            >
                <p>
                    <strong>Taxa de entrega por bairro</strong> é um modelo em que
                    o restaurante define antecipadamente quanto cobra para atender
                    cada região. Em vez de usar uma única taxa para toda a cidade ou
                    calcular apenas a distância, cada bairro pode ter um valor e um
                    prazo próprios.
                </p>
                <p>
                    Um exemplo simples seria cobrar R$ 4 no Centro, R$ 7 em um bairro
                    intermediário e R$ 10 em uma região mais distante. Quando o
                    cliente informa o endereço, o sistema identifica o bairro e usa
                    a regra correspondente.
                </p>
                <BlogCallout
                    title="Distância não explica todo o custo"
                    variant="info"
                >
                    Dois bairros podem estar a uma distância parecida e ainda exigir
                    tempos de entrega muito diferentes por causa de trânsito, acesso,
                    retorno do entregador ou rota disponível.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="como-calcular"
                title="Como calcular taxa de entrega por bairro sem perder margem"
            >
                <p>
                    O ponto de partida não deve ser apenas o preço do concorrente.
                    Primeiro, entenda quanto custa atender cada região na prática.
                    O valor da entrega precisa fazer sentido para o cliente, mas
                    também precisa evitar que pedidos de bairros caros sejam
                    subsidiados silenciosamente pelos bairros baratos.
                </p>
                <BlogSteps
                    items={[
                        {
                            title: "Liste os bairros que realmente recebem pedidos",
                            description:
                                "Comece pelas regiões recorrentes. Não é necessário mapear a cidade inteira antes de colocar a regra em uso.",
                        },
                        {
                            title: "Observe distância e tempo real",
                            description:
                                "Compare quilômetros, trânsito, acesso, tempo de ida e retorno. O tempo total costuma revelar custos que a distância sozinha esconde.",
                        },
                        {
                            title: "Some o custo operacional da entrega",
                            description:
                                "Considere o valor pago ao entregador, combustível quando aplicável e qualquer custo diretamente ligado à corrida.",
                        },
                        {
                            title: "Agrupe regiões parecidas",
                            description:
                                "Bairros com custo semelhante podem receber a mesma taxa. Uma tabela simples é mais fácil de manter do que dezenas de diferenças sem necessidade.",
                        },
                        {
                            title: "Revise com pedidos reais",
                            description:
                                "Depois de algumas semanas, compare prazo prometido, custo e margem. Ajuste apenas as regiões em que a realidade divergiu da tabela.",
                        },
                    ]}
                />
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th className="px-5 py-4 font-bold">Bairro</th>
                                <th className="px-5 py-4 font-bold">Tempo estimado</th>
                                <th className="px-5 py-4 font-bold">Taxa</th>
                                <th className="px-5 py-4 font-bold">Leitura operacional</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Centro</td>
                                <td className="px-5 py-4">30 min</td>
                                <td className="px-5 py-4">R$ 4</td>
                                <td className="px-5 py-4">Rota curta e recorrente</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Jardim Paulista</td>
                                <td className="px-5 py-4">40 min</td>
                                <td className="px-5 py-4">R$ 7</td>
                                <td className="px-5 py-4">Tempo intermediário</td>
                            </tr>
                            <tr>
                                <td className="px-5 py-4 font-semibold text-gray-900">Vila Nova</td>
                                <td className="px-5 py-4">50 min</td>
                                <td className="px-5 py-4">R$ 10</td>
                                <td className="px-5 py-4">Rota mais longa ou difícil</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Os valores acima são apenas um exemplo de estrutura. A taxa certa
                    depende dos custos e da geografia de cada restaurante.
                </p>
            </BlogSection>

            <BlogSection
                id="bairro-ou-km"
                title="Taxa por bairro ou taxa por quilômetro: qual escolher?"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <h3 className="font-bold text-gray-950">Entrega por Bairro</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            Faz sentido quando o restaurante atende regiões conhecidas,
                            quer uma tabela previsível e já sabe que bairros parecidos em
                            quilômetros podem ter custos diferentes na prática.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <h3 className="font-bold text-gray-950">Entrega por KM</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            É útil quando os endereços variam muito e a distância é uma
                            boa aproximação do custo da entrega. A regra muda conforme a
                            faixa de quilômetros configurada.
                        </p>
                    </div>
                </div>
                <p>
                    Não existe um modelo universalmente melhor. O importante é que a
                    cobrança represente a operação real e seja fácil de explicar para
                    quem administra o delivery.
                </p>
            </BlogSection>

            <BlogSection
                id="como-configurar"
                title="Como configurar taxa de entrega por bairro no iMenu"
            >
                <p>
                    No iMenu, a escolha fica em <strong>Tempo e Taxa</strong>. O
                    restaurante pode usar <strong>Entrega por KM</strong> ou
                    <strong> Entrega por Bairro</strong>. Ao selecionar o modo por
                    bairro, cada regra recebe as informações necessárias para o
                    checkout calcular o valor correto.
                </p>
                <BlogChecklist
                    items={[
                        "Informe o nome do bairro atendido",
                        "Use cidade e UF para evitar conflito entre bairros com o mesmo nome",
                        "Defina o tempo estimado daquela região",
                        "Defina a taxa de entrega em reais",
                        "Cadastre pelo menos um bairro válido para ativar o modo",
                        "Faça um pedido de teste com endereço de uma região cadastrada",
                    ]}
                />
                <p>
                    O cardápio público também passa a usar as taxas dos bairros para
                    representar a faixa de entrega quando esse é o modo ativo. Assim,
                    o valor apresentado ao cliente acompanha a configuração realmente
                    usada no checkout.
                </p>
            </BlogSection>

            <BlogSection
                id="endereco"
                title="Como o iMenu identifica o bairro do endereço"
            >
                <p>
                    O checkout usa o bairro informado no endereço e procura uma regra
                    correspondente. Para reduzir erros simples de digitação, o iMenu
                    normaliza diferenças de maiúsculas e minúsculas, acentos e algumas
                    abreviações comuns, como <strong>Jd</strong> para Jardim,
                    <strong> Vl</strong> para Vila e <strong>Pq</strong> para Parque.
                </p>
                <p>
                    Quando cidade e UF estão cadastradas na regra, elas também entram
                    na validação. Isso evita aplicar a taxa de um bairro homônimo que
                    pertence a outro município ou estado.
                </p>
                <BlogCallout
                    title="Bairro não encontrado não deve virar taxa aleatória"
                    variant="warning"
                >
                    Se o endereço não corresponder a uma região configurada, o mais
                    seguro é corrigir o bairro antes de finalizar. No modo por bairro,
                    o iMenu pode orientar o cliente a verificar se o nome foi escrito
                    corretamente.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="frete-gratis"
                title="Combine taxa por bairro com promoções de entrega grátis"
            >
                <p>
                    Ter uma tabela correta não impede o restaurante de usar frete como
                    ferramenta comercial. A diferença é que a promoção passa a ser uma
                    decisão consciente, em vez de esconder o custo real da operação.
                </p>
                <p>
                    Um restaurante pode manter R$ 5, R$ 7 e R$ 10 para três regiões
                    diferentes e, ao mesmo tempo, criar uma campanha como
                    <strong> entrega grátis aos domingos em pedidos a partir de R$ 60</strong>.
                    Quando a condição é cumprida, a promoção remove a entrega; fora
                    dela, a tabela normal continua valendo.
                </p>
                <BlogCallout title="Use frete grátis com objetivo" variant="tip">
                    Se a meta é aumentar ticket médio, vincule o benefício a um valor
                    mínimo que faça sentido para a sua margem em vez de liberar entrega
                    grátis para qualquer pedido.
                </BlogCallout>
            </BlogSection>

            <BlogSection
                id="erros"
                title="Erros comuns ao montar a tabela de entrega por bairro"
            >
                <BlogSubheading>Cobrar o mesmo valor em regiões muito diferentes</BlogSubheading>
                <p>
                    A simplicidade é boa, mas uma taxa única pode fazer bairros baratos
                    subsidiarem bairros caros. Separe regiões quando a diferença de
                    custo for material.
                </p>
                <BlogSubheading>Copiar o concorrente sem conhecer o próprio custo</BlogSubheading>
                <p>
                    O concorrente pode ter outro ponto de saída, outro acordo com
                    entregadores e outro ticket médio. Use o mercado como referência,
                    não como planilha de custos.
                </p>
                <BlogSubheading>Prometer o mesmo prazo para todos os bairros</BlogSubheading>
                <p>
                    Taxa e tempo devem conversar. Se uma região exige deslocamento
                    maior, o prazo estimado também precisa refletir isso.
                </p>
                <BlogSubheading>Não testar o endereço antes de divulgar</BlogSubheading>
                <p>
                    Faça pedidos de teste para bairros cadastrados e não cadastrados.
                    O cliente deve receber a taxa esperada e uma mensagem clara quando
                    o endereço não estiver coberto pela configuração.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}

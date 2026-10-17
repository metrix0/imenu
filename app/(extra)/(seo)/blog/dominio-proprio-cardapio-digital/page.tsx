import Link from "next/link";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogCallout,
    BlogChecklist,
    BlogSection,
    BlogSteps,
    BlogSubheading,
} from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("dominio-proprio-cardapio-digital")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "o-que-e", label: "O que é um domínio próprio" },
    { id: "qual-endereco", label: "Domínio ou subdomínio?" },
    { id: "como-configurar", label: "Passo a passo no iMenu" },
    { id: "configurar-dns", label: "Como configurar o DNS" },
    { id: "confirmar", label: "Como conferir se funcionou" },
    { id: "seo", label: "Domínio próprio e SEO" },
    { id: "problemas", label: "Problemas comuns e soluções" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Posso usar meu próprio domínio no cardápio digital do iMenu?",
        answer: "Sim. Em Perfil da Loja, clique em Usar meu domínio, informe o endereço desejado e configure no provedor do domínio os registros DNS exibidos pelo iMenu. Depois, verifique o status da conexão.",
    },
    {
        question: "Preciso comprar um domínio para usar esse recurso?",
        answer: "Você precisa ter controle sobre um domínio registrado, próprio ou da empresa. O registro e a renovação são contratados com um provedor de domínios e podem ter cobrança separada. O iMenu não vende o registro do domínio.",
    },
    {
        question: "Posso usar pedidos.meurestaurante.com.br sem mudar meu site principal?",
        answer: "Sim, um subdomínio é uma opção para manter o site principal em meurestaurante.com.br e usar pedidos.meurestaurante.com.br para o cardápio. Configure o endereço exato no iMenu e ajuste apenas os registros DNS correspondentes.",
    },
    {
        question: "O iMenu informa qual registro DNS devo adicionar?",
        answer: "Sim. A tela Usar meu domínio mostra o tipo, o nome e o valor do registro quando a configuração está pendente. Siga os dados apresentados para o seu domínio, pois eles podem variar conforme a infraestrutura utilizada.",
    },
    {
        question: "Quanto tempo demora para o domínio começar a funcionar?",
        answer: "A mudança depende da atualização dos registros DNS e da verificação da conexão. Pode levar algum tempo até a alteração ser percebida por todos os dispositivos e redes. Use Verificar novamente no iMenu e teste o endereço no navegador.",
    },
    {
        question: "O link original do cardápio deixa de funcionar?",
        answer: "Não. Associar um domínio próprio não remove automaticamente o endereço original do cardápio no iMenu. Você pode continuar usando o link original enquanto divulga o novo endereço.",
    },
    {
        question: "Ter um domínio próprio melhora a posição no Google automaticamente?",
        answer: "Não. Um endereço personalizado ajuda na identidade da marca e na divulgação, mas não garante posições no Google. Conteúdo útil, informações atualizadas, acessibilidade e configuração correta das URLs continuam importantes.",
    },
    {
        question: "Posso trocar ou desconectar meu domínio depois?",
        answer: "Sim. Volte a Perfil da Loja, abra Usar meu domínio e utilize Atualizar domínio ou Desconectar. Antes de alterar o endereço divulgado, atualize os links compartilhados com seus clientes.",
    },
];

export default function DominioProprioCardapioDigitalPage() {
    return (
        <BlogArticle
            article={article}
            icon={faGlobe}
            takeaways={[
                "Escolher entre domínio próprio e subdomínio para seu delivery",
                "Conectar seu endereço ao cardápio digital em poucos passos",
                "Entender os registros DNS sem precisar decorar termos técnicos",
                "Conferir a conexão e evitar erros comuns na divulgação",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={[
                "como-vender-delivery-pelo-whatsapp",
                "cardapio-digital-qr-code-restaurante",
                "como-montar-cardapio-delivery",
            ]}
            ctaTitle="Seu cardápio digital, com a identidade do seu restaurante"
        >
            <BlogSection id="o-que-e" title="Seu cardápio digital pode ter o endereço da sua marca">
                <p>
                    Imagine colocar <strong>pedidos.suapizzaria.com.br</strong> na bio do Instagram,
                    no WhatsApp e nos materiais da sua loja. Quando o cliente acessa esse
                    endereço, encontra o cardápio do seu restaurante, com os produtos e as
                    opções de pedido que você já configurou no iMenu.
                </p>
                <p>
                    Isso é usar um <strong>domínio próprio no cardápio digital</strong>:
                    em vez de divulgar somente um link da plataforma, você pode conectar
                    um endereço que pertence à sua marca. O iMenu continua cuidando do
                    cardápio e dos pedidos; você continua atualizando tudo pelo painel.
                </p>
                <BlogCallout title="Você não precisa criar outro cardápio" variant="tip">
                    O domínio personalizado é um endereço de acesso ao cardápio existente.
                    Você não precisa duplicar produtos, preços ou categorias para usá-lo.
                </BlogCallout>
                <p>
                    Se você ainda está montando seu menu, veja também{" "}
                    <Link href="/cardapio-digital-gratuito" className="font-semibold text-brand hover:underline">
                        como criar um cardápio digital gratuito
                    </Link>{" "}
                    antes de conectar o domínio.
                </p>
            </BlogSection>

            <BlogSection id="qual-endereco" title="Domínio próprio ou subdomínio: qual escolher para o restaurante?">
                <p>
                    Você pode usar o endereço principal do negócio ou reservar uma parte
                    dele somente para o delivery. A melhor escolha depende de onde seu
                    site funciona hoje.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[620px] text-left text-sm leading-6">
                        <caption className="sr-only">Comparação entre domínio principal e subdomínio para o cardápio digital</caption>
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th scope="col" className="px-5 py-4 font-bold">Opção</th>
                                <th scope="col" className="px-5 py-4 font-bold">Exemplo</th>
                                <th scope="col" className="px-5 py-4 font-bold">Quando usar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Domínio principal</th>
                                <td className="px-5 py-4">suapizzaria.com.br</td>
                                <td className="px-5 py-4">Quando você quer que o endereço principal abra o cardápio e ele não precisa continuar apontando para outro site.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Subdomínio</th>
                                <td className="px-5 py-4">pedidos.suapizzaria.com.br</td>
                                <td className="px-5 py-4">Quando você já tem um site institucional e quer manter esse site separado dos pedidos.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogCallout title="Já tem um site funcionando? Prefira um subdomínio" variant="warning">
                    Alterar os registros do domínio principal pode fazer o site atual
                    deixar de abrir naquele endereço. Para manter as duas experiências,
                    normalmente é mais seguro criar um endereço como{" "}
                    <strong>pedidos.seurestaurante.com.br</strong>.
                </BlogCallout>
                <BlogSubheading>O que você precisa ter em mãos</BlogSubheading>
                <BlogChecklist items={[
                    <span key="dominio"><strong>Um domínio registrado:</strong> com acesso ao painel onde os registros DNS são administrados.</span>,
                    <span key="conta"><strong>Seu restaurante no iMenu:</strong> com acesso à área Perfil da Loja.</span>,
                    <span key="endereco"><strong>O endereço escolhido:</strong> por exemplo, o domínio principal ou o subdomínio de pedidos.</span>,
                    <span key="teste"><strong>Alguns minutos para conferir:</strong> depois de salvar, você precisará validar o DNS e abrir o link.</span>,
                ]} />
            </BlogSection>

            <BlogSection id="como-configurar" title="Como colocar seu domínio próprio no cardápio digital do iMenu">
                <p>
                    O processo começa no painel do próprio restaurante. Você não precisa
                    contratar outra hospedagem para reproduzir seu cardápio: precisa
                    conectar o nome de domínio ao endereço indicado pelo iMenu.
                </p>
                <BlogSteps items={[
                    {
                        title: "Abra o Perfil da Loja",
                        description: <>Entre no <Link href="/painel/loja" className="font-semibold text-brand hover:underline">painel do iMenu, em Perfil da Loja</Link>, onde aparecem o nome do restaurante e o Link do cardápio.</>,
                    },
                    {
                        title: "Clique em Usar meu domínio",
                        description: "O botão fica próximo ao campo Link do cardápio. Ele abre a janela de conexão do domínio personalizado.",
                    },
                    {
                        title: "Digite o domínio que deseja utilizar",
                        description: "Informe somente o endereço, como suapizzaria.com.br ou pedidos.suapizzaria.com.br, sem adicionar caminhos ou páginas. Clique em Conectar domínio.",
                    },
                    {
                        title: "Copie as informações de DNS",
                        description: "Se a conexão ainda não estiver pronta, o iMenu mostra o tipo, o nome e o valor do registro que você precisa configurar. Se houver uma etapa de verificação, os dados também aparecem na tela.",
                    },
                    {
                        title: "Atualize o DNS no provedor e verifique",
                        description: "No serviço onde seu domínio é administrado, ajuste os registros necessários. Volte ao iMenu, clique em Verificar novamente e abra seu endereço no navegador.",
                    },
                ]} />
                <p>
                    Quando a tela indicar <strong>Domínio conectado</strong> e o endereço
                    abrir o cardápio corretamente, você poderá usá-lo nos canais de divulgação.
                </p>
            </BlogSection>

            <BlogSection id="configurar-dns" title="Como configurar o DNS do domínio sem prejudicar seu site ou e-mail">
                <p>
                    <strong>DNS</strong> é a configuração que informa para onde um
                    endereço na internet deve levar. Pense no domínio como o nome
                    da sua loja na rua e no DNS como a indicação do endereço correto.
                    Você administra esses dados no provedor do domínio.
                </p>
                <p>
                    Dentro da janela <strong>Usar meu domínio</strong>, confira os três
                    campos mostrados pelo iMenu: <strong>Tipo, Nome e Valor</strong>.
                    No painel DNS do seu provedor, crie ou edite o registro correspondente
                    com <strong>exatamente os dados exibidos</strong>.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[620px] text-left text-sm leading-6">
                        <caption className="sr-only">Significado dos campos de DNS para conectar um domínio ao iMenu</caption>
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th scope="col" className="px-5 py-4 font-bold">Campo</th>
                                <th scope="col" className="px-5 py-4 font-bold">O que significa</th>
                                <th scope="col" className="px-5 py-4 font-bold">Atenção</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Tipo</th>
                                <td className="px-5 py-4">A ou CNAME, conforme a instrução mostrada.</td>
                                <td className="px-5 py-4">Não escolha outro tipo por conta própria.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Nome</th>
                                <td className="px-5 py-4">A parte do endereço que será configurada, como @ ou pedidos.</td>
                                <td className="px-5 py-4">Alguns provedores pedem o endereço completo.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Valor</th>
                                <td className="px-5 py-4">O destino para o qual o domínio deve apontar.</td>
                                <td className="px-5 py-4">Use o valor atual que aparece no seu painel iMenu.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <BlogCallout title="Não copie IPs ou destinos de tutoriais antigos" variant="warning">
                    Os valores de DNS podem variar. Use sempre os dados exibidos
                    no seu painel, não um IP encontrado em outro artigo ou vídeo.
                    Remova somente registros conflitantes com o endereço escolhido,
                    como A, AAAA, CNAME ou ALIAS, quando necessário. <strong>Não apague
                    registros MX ou TXT do e-mail da empresa.</strong>
                </BlogCallout>
                <p>
                    Se o iMenu apresentar um registro de verificação adicional,
                    configure-o conforme solicitado. Caso você não tenha acesso
                    ao DNS, peça ao responsável pelo domínio para realizar essa etapa.
                </p>
            </BlogSection>

            <BlogSection id="confirmar" title="Como saber se o domínio personalizado já está funcionando">
                <p>
                    Salvar o endereço no iMenu não significa que o DNS já foi atualizado
                    em todas as redes. A própria janela indica se a verificação ou a
                    configuração ainda está pendente.
                </p>
                <BlogSteps items={[
                    {
                        title: "Confira o status no iMenu",
                        description: "Volte a Usar meu domínio e clique em Verificar novamente. Se ainda houver pendência, revise o registro mostrado.",
                    },
                    {
                        title: "Abra o endereço escolhido",
                        description: "Digite o domínio completo no navegador e confirme que ele abre o cardápio correto, com o nome e os produtos do seu restaurante.",
                    },
                    {
                        title: "Teste o pedido no celular",
                        description: "Confira fotos, preços, complementos, carrinho e a etapa de finalização de acordo com as opções da sua loja. Valide também o acesso seguro por HTTPS.",
                    },
                    {
                        title: "Atualize seus canais",
                        description: "Depois do teste, substitua o link na bio do Instagram, no WhatsApp Business, no QR Code e em campanhas que levam ao cardápio.",
                    },
                ]} />
                <p>
                    O endereço antigo do cardápio no iMenu continua existindo;
                    conectar seu domínio não o remove automaticamente. Para deixar
                    claro qual link é o oficial, prefira divulgar um endereço consistente.
                </p>
            </BlogSection>

            <BlogSection id="seo" title="Domínio próprio ajuda no SEO do delivery? O que realmente importa">
                <p>
                    Um domínio próprio pode tornar o link mais fácil de reconhecer,
                    memorizar e divulgar. Isso fortalece a apresentação da marca,
                    especialmente quando alguém vê o endereço num anúncio, num QR Code
                    ou numa conversa de WhatsApp.
                </p>
                <p>
                    Mas <strong>ter palavras-chave no domínio ou trocar o endereço
                    não faz seu restaurante subir automaticamente no Google</strong>.
                    A descoberta por mecanismos de busca depende de vários fatores,
                    incluindo a qualidade das informações, a experiência de navegação
                    e quais URLs os mecanismos conseguem acessar e interpretar.
                </p>
                <BlogSubheading>Checklist de divulgação e SEO para seu novo endereço</BlogSubheading>
                <BlogChecklist items={[
                    <span key="unico"><strong>Divulgue um link principal:</strong> use o mesmo endereço na bio, no WhatsApp, em QR Codes e em materiais.</span>,
                    <span key="nome"><strong>Deixe a marca clara:</strong> mantenha nome, identidade visual, descrição e produtos atualizados.</span>,
                    <span key="mobile"><strong>Teste no celular:</strong> confirme legibilidade, imagens, opções e finalização do pedido.</span>,
                    <span key="google"><strong>Atualize seus perfis:</strong> troque o link onde clientes procuram o restaurante, inclusive no Perfil da Empresa no Google, quando aplicável.</span>,
                    <span key="url"><strong>Evite confundir URLs:</strong> se o mesmo conteúdo existir em endereços diferentes, os buscadores podem escolher um deles como principal.</span>,
                    <span key="medir"><strong>Acompanhe resultados:</strong> observe acessos e pedidos antes e depois da divulgação, sem atribuir toda mudança apenas ao domínio.</span>,
                ]} />
                <p>
                    Para entender como um link próprio se encaixa numa estratégia
                    maior, leia o guia de{" "}
                    <Link href="/blog/como-vender-delivery-pelo-whatsapp" className="font-semibold text-brand hover:underline">
                        como vender delivery pelo WhatsApp
                    </Link>{" "}
                    e compare os caminhos no artigo sobre{" "}
                    <Link href="/cardapio-digital" className="font-semibold text-brand hover:underline">
                        cardápio digital para restaurante
                    </Link>.
                </p>
            </BlogSection>

            <BlogSection id="problemas" title="Domínio não abre? Veja os problemas mais comuns">
                <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[700px] text-left text-sm leading-6">
                        <caption className="sr-only">Problemas comuns ao conectar domínio próprio ao cardápio digital e soluções</caption>
                        <thead className="bg-gray-50 text-gray-900">
                            <tr>
                                <th scope="col" className="px-5 py-4 font-bold">O que aparece</th>
                                <th scope="col" className="px-5 py-4 font-bold">O que verificar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-600">
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Configuração de DNS pendente</th>
                                <td className="px-5 py-4">Confira Tipo, Nome e Valor no provedor; procure registros conflitantes e aguarde a atualização do DNS.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Verificação do domínio pendente</th>
                                <td className="px-5 py-4">Veja se a janela solicitou algum registro adicional de verificação e configure-o.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">O endereço abre outro site</th>
                                <td className="px-5 py-4">O domínio pode continuar apontando para a hospedagem anterior ou pode haver um registro antigo ativo.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Funciona com www, mas não sem www (ou vice-versa)</th>
                                <td className="px-5 py-4">São endereços diferentes no DNS. Confira qual deles você cadastrou e configurou no iMenu.</td>
                            </tr>
                            <tr>
                                <th scope="row" className="px-5 py-4 font-semibold text-gray-900">Site ou e-mail parou de funcionar</th>
                                <td className="px-5 py-4">Revise alterações feitas em registros existentes. Evite mudar o domínio principal de um site ativo ou remover registros de e-mail.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    Se ainda houver dificuldade, abra a janela <strong>Usar meu domínio</strong>,
                    confira os dados do registro e informe ao suporte qual endereço
                    está configurando e qual status aparece. Isso ajuda a encontrar
                    a causa sem alterar registros desnecessários.
                </p>
                <BlogCallout title="Próximo passo: publique o link da sua marca" variant="tip">
                    Quando o domínio abrir corretamente, atualize primeiro os links
                    que recebem mais visitas. Um endereço simples e consistente torna
                    mais fácil para seus clientes reconhecerem onde fazer o pedido.
                </BlogCallout>
            </BlogSection>
        </BlogArticle>
    );
}

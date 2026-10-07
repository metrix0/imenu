import Link from "next/link";
import { SeoPage } from "@/components/common/SeoPage";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChartSimple,
    faChevronDown,
    faLink,
    faLockOpen,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

const faq = [
    {
        question: "Qual é o melhor cardápio digital grátis para restaurante?",
        answer:
            "Para quem quer começar sem mensalidade, o iMenu oferece cardápio digital gratuito, pedidos ilimitados e criação rápida. A melhor opção depende do nível de gestão, PDV e integrações que o restaurante precisa.",
    },
    {
        question: "Como criar um cardápio digital grátis?",
        answer:
            "Você pode criar uma conta no iMenu, cadastrar os produtos ou importar seu cardápio com IA e publicar um link para compartilhar com os clientes. Também há uma ferramenta gratuita para montar um rascunho de cardápio digital.",
    },
    {
        question: "Cardápio digital funciona por QR Code e WhatsApp?",
        answer:
            "Sim. O mesmo cardápio pode ser compartilhado por link no WhatsApp, Instagram e Google ou aberto por um QR Code impresso no restaurante.",
    },
    {
        question: "Cardápio digital e cardápio online são a mesma coisa?",
        answer:
            "Na prática, os termos costumam ser usados como sinônimos. Ambos descrevem um menu acessado pela internet, normalmente por link ou QR Code, com produtos, preços e informações atualizadas.",
    },
    {
        question: "Preciso pagar mensalidade para ter um cardápio digital?",
        answer:
            "Não necessariamente. Existem opções gratuitas, como o iMenu, e plataformas pagas que incluem módulos adicionais de PDV, estoque, financeiro, autoatendimento e gestão.",
    },
];

const comparisonRows = [
    {
        name: "iMenu",
        href: "/",
        logo: "/logos/LogoMark_Brand.png",
        includes: "Cardápio digital + pedidos + automação",
        price: "Grátis sem limites (sem taxas nem mensalidade)",
    },
    {
        name: "Anota Ai",
        href: "/anota-ai",
        logo: "https://www.google.com/s2/favicons?sz=64&domain_url=https://anota.ai",
        includes: "Cardápio + pedidos + automação",
        price: "Mensalidade",
    },
    {
        name: "Goomer",
        href: "/goomer",
        logo: "https://www.google.com/s2/favicons?sz=64&domain_url=https://goomer.com.br",
        includes: "Cardápio + pedidos",
        price: "Grátis limitado + planos pagos",
    },
    {
        name: "Saipos",
        href: "/saipos",
        logo: "https://www.google.com/s2/favicons?sz=64&domain_url=https://saipos.com",
        includes: "Cardápio + PDV + gestão",
        price: "Mensalidade",
    },
    {
        name: "Consumer",
        href: "/consumer",
        logo: "https://www.google.com/s2/favicons?sz=64&domain_url=https://consumer.com.br",
        includes: "Cardápio + PDV + gestão",
        price: "Grátis limitado + planos pagos",
    },
];

export const metadata = {
    title: "Top 5 Cardápios Digitais Gratuitos no Brasil | iMenu",
    description:
        "Compare 5 opções de cardápio digital para restaurantes em 2026, incluindo alternativas grátis e pagas. Veja recursos, custos e qual faz mais sentido para sua operação.",
    alternates: {
        canonical: "https://www.imenuapp.com.br/cardapio-digital",
    },
};

export default function Page() {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
                }}
            />

            <SeoPage
                h1="Top 5 Cardápios Digitais Gratuitos no Brasil"
                description={
                    <>
                        Compare opções de <strong>cardápio digital</strong> grátis e pagas,
                        entenda as diferenças e escolha a melhor para o seu restaurante.
                    </>
                }
                imageSrc="/images/Top-5-Cardapios-Digitais.png"
                imageAlt="Comparação dos melhores cardápios digitais para restaurantes"
                ctaLabel="Criar cardápio digital grátis"
            >
                <section>
                    <h2 className="mb-4 text-2xl font-bold">
                        O que é um cardápio digital?
                    </h2>
                    <p className="text-gray-600">
                        Um <strong>cardápio digital</strong> ou <strong>cardápio online</strong>
                        {" "}permite que o restaurante mostre produtos, preços, fotos e adicionais
                        por um link ou QR Code. Além de substituir o menu impresso, ele pode
                        receber pedidos e ser compartilhado no WhatsApp, Instagram e Google.
                    </p>
                </section>

                <section>
                    <h2 className="mb-4 text-2xl font-bold">
                        Comparação rápida das plataformas
                    </h2>

                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                        <table className="w-full min-w-[620px] text-left text-sm">
                            <thead className="bg-gray-50 text-gray-900">
                                <tr>
                                    <th className="px-5 py-4 font-semibold">Plataforma</th>
                                    <th className="px-5 py-4 font-semibold">Inclui</th>
                                    <th className="px-5 py-4 font-semibold">Preço</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {comparisonRows.map((item) => (
                                    <tr key={item.name}>
                                        <td className="px-5 py-4">
                                            <Link
                                                href={item.href}
                                                className="inline-flex items-center gap-3 font-semibold text-gray-900 hover:text-brand"
                                            >
                                                <img
                                                    src={item.logo}
                                                    alt=""
                                                    className="h-8 w-8 rounded-lg object-contain"
                                                    loading="lazy"
                                                />
                                                {item.name}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600">{item.includes}</td>
                                        <td className="px-5 py-4 font-medium text-gray-700">{item.price}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                        Planos e condições de plataformas de terceiros podem mudar. Confirme
                        sempre os valores e recursos atuais antes de contratar.
                    </p>
                </section>

                <section>
                    <h2 className="mb-4 text-2xl font-bold">
                        Comparando os melhores cardápios digitais
                    </h2>
                    <p className="mb-6 text-gray-600">
                        Ao comparar plataformas de cardápio digital, vale olhar principalmente
                        para custo, facilidade de uso e quanto de gestão extra sua operação
                        realmente precisa.
                    </p>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="rounded-xl bg-gray-50 p-5">
                            <h3 className="mb-2 text-lg font-semibold">
                                Plataformas mais completas
                            </h3>
                            <ul className="space-y-2 text-gray-600 list-disc list-inside">
                                <li>Planos gratuitos costumam ter limites</li>
                                <li>Recursos avançados geralmente ficam nos planos pagos</li>
                                <li>Mais módulos de PDV, gestão e autoatendimento</li>
                                <li>Mais configuração para começar</li>
                            </ul>
                        </div>

                        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                            <h3 className="mb-2 text-lg font-semibold text-green-700">
                                iMenu
                            </h3>
                            <ul className="space-y-2 text-gray-700 list-disc list-inside">
                                <li>Grátis, sem mensalidade nem taxa</li>
                                <li>Pedidos e acessos ilimitados</li>
                                <li>Configuração em minutos</li>
                                <li>Foco em cardápio, pedidos e simplicidade</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-4 text-2xl font-bold">
                        Como escolher um cardápio digital para restaurante
                    </h2>
                    <ul className="space-y-3 text-gray-600 list-disc list-inside">
                        <li>Teste o pedido completo no celular do cliente.</li>
                        <li>Compare mensalidade, taxas e custos de implantação.</li>
                        <li>Veja se você realmente precisa de PDV, estoque e financeiro no mesmo sistema.</li>
                        <li>Confira se o cardápio funciona bem por link, WhatsApp e QR Code.</li>
                        <li>Priorize uma solução que sua equipe consiga atualizar sem depender de suporte.</li>
                    </ul>
                    <p className="mt-5 text-gray-600">
                        Para montar o conteúdo do menu antes de publicar, use nosso{" "}
                        <Link
                            href="/ferramentas/gerador-cardapio-digital"
                            className="text-brand underline"
                        >
                            gerador gratuito de cardápio digital
                        </Link>
                        . Para o salão, você também pode criar um código na{" "}
                        <Link
                            href="/ferramentas/gerador-qr-code-cardapio"
                            className="text-brand underline"
                        >
                            ferramenta gratuita de QR Code
                        </Link>
                        .
                    </p>
                </section>

                <section className="space-y-10">
                    <h2 className="text-2xl font-bold">
                        Por que o iMenu se destaca entre os cardápios digitais
                    </h2>

                    <div className="grid grid-cols-1 gap-x-14 gap-y-10 md:grid-cols-2">
                        <div className="flex gap-4">
                            <FontAwesomeIcon
                                icon={faWandMagicSparkles}
                                className="mt-1 text-brand"
                            />
                            <div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    Leitura automática de cardápio com IA
                                </h3>
                                <p className="leading-relaxed text-gray-600">
                                    Envie uma foto ou PDF do seu cardápio e o iMenu converte
                                    automaticamente em um cardápio digital estruturado, com
                                    categorias, produtos e preços.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <FontAwesomeIcon
                                icon={faLockOpen}
                                className="mt-1 text-brand"
                            />
                            <div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    Gratuito para começar
                                </h3>
                                <p className="leading-relaxed text-gray-600">
                                    Sem mensalidade para o cardápio digital e com pedidos
                                    ilimitados, o restaurante pode começar sem adicionar um
                                    novo custo fixo à operação.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <FontAwesomeIcon
                                icon={faLink}
                                className="mt-1 text-brand"
                            />
                            <div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    Um link para todos os canais
                                </h3>
                                <p className="leading-relaxed text-gray-600">
                                    Compartilhe o cardápio no WhatsApp, Instagram, Google ou
                                    QR Code sem criar versões diferentes para cada canal.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <FontAwesomeIcon
                                icon={faChartSimple}
                                className="mt-1 text-brand"
                            />
                            <div>
                                <h3 className="mb-2 text-lg font-semibold">
                                    Experiência focada em pedidos
                                </h3>
                                <p className="leading-relaxed text-gray-600">
                                    O fluxo é pensado para facilitar a escolha do cliente e
                                    reduzir etapas desnecessárias até a conclusão do pedido.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-4 text-2xl font-bold">
                        Qual é o melhor cardápio digital gratuito?
                    </h2>
                    <p className="text-gray-600">
                        Para restaurantes que querem publicar um cardápio online e receber
                        pedidos sem assumir uma mensalidade, o iMenu é uma opção direta:
                        cardápio digital gratuito, pedidos ilimitados e configuração rápida.
                        Quem precisa de uma suíte completa de PDV, estoque, financeiro ou
                        autoatendimento pode preferir uma plataforma mais ampla.
                    </p>
                    <p className="mt-4 text-gray-600">
                        Se ainda está estruturando seu menu, veja também{" "}
                        <Link
                            href="/blog/como-montar-cardapio-delivery"
                            className="text-brand underline"
                        >
                            como montar um cardápio para delivery
                        </Link>
                        .
                    </p>

                    <Link href="/restaurante/registrar">
                        <Button className="mt-6 px-8 py-3">
                            Criar meu cardápio grátis
                        </Button>
                    </Link>
                </section>

                <section className="border-l-4 border-brand pl-6 md:pl-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                        100% grátis
                    </p>
                    <p className="mt-3 text-3xl font-extrabold leading-tight text-gray-950 md:text-4xl">
                        Sim, o iMenu é o primeiro cardápio totalmente grátis do Brasil!
                    </p>
                    <p className="mt-4 text-lg font-medium text-gray-600">
                        Sem limites. Sem taxas. Sem mensalidade.
                    </p>
                </section>

                <section>
                    <h2 className="mb-5 text-2xl font-bold">
                        Perguntas frequentes sobre cardápio digital
                    </h2>
                    <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-5">
                        {faq.map((item) => (
                            <details key={item.question} className="group py-5">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                                    {item.question}
                                    <FontAwesomeIcon
                                        aria-hidden="true"
                                        icon={faChevronDown}
                                        className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <p className="mt-3 pr-8 text-sm leading-6 text-gray-600">
                                    {item.answer}
                                </p>
                            </details>
                        ))}
                    </div>
                </section>
            </SeoPage>
        </>
    );
}

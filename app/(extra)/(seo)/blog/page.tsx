import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faBellConcierge,
    faBookOpen,
    faChartLine,
    faComments,
    faMoneyBillTransfer,
    faReceipt,
    faStore,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";

import RestaurantToolsCta from "@/components/common/restaurant-tools/RestaurantToolsCta";
import RestaurantToolIcon from "@/components/common/restaurant-tools/RestaurantToolIcon";
import {
    BLOG_ARTICLES,
    BLOG_SITE_URL,
    EXISTING_BLOG_PAGES,
    getBlogArticlePath,
} from "@/lib/seo/blogArticles";
import {
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";

export const metadata: Metadata = {
    title: "Blog para restaurantes: delivery, cardápio e gestão | iMenu",
    description:
        "Guias práticos para vender no delivery, montar cardápios, calcular taxas, aumentar o ticket médio e organizar pedidos.",
    alternates: { canonical: `${BLOG_SITE_URL}/blog` },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "pt_BR",
        siteName: "iMenu",
        url: `${BLOG_SITE_URL}/blog`,
        title: "Guias práticos para restaurantes e delivery",
        description:
            "Conteúdo direto ao ponto, com contas, exemplos, checklists e próximos passos aplicáveis à operação.",
    },
};

const articleIcons = [
    faBellConcierge,
    faComments,
    faUtensils,
    faStore,
    faChartLine,
    faReceipt,
    faMoneyBillTransfer,
    faComments,
    faUtensils,
    faChartLine,
    faStore,
];

export default function BlogPage() {
    const allPages = [
        ...BLOG_ARTICLES.map((article) => ({
            name: article.title,
            url: `${BLOG_SITE_URL}${getBlogArticlePath(article.slug)}`,
        })),
        ...EXISTING_BLOG_PAGES.map((article) => ({
            name: article.title,
            url: `${BLOG_SITE_URL}${article.path}`,
        })),
    ];
    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Blog iMenu para restaurantes",
            description: metadata.description,
            url: `${BLOG_SITE_URL}/blog`,
            inLanguage: "pt-BR",
        },
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Guias do iMenu para restaurantes",
            numberOfItems: allPages.length,
            itemListElement: allPages.map((page, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: page.name,
                url: page.url,
            })),
        },
    ];

    return (
        <article className="w-full">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
                }}
            />

            <header className="overflow-hidden border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50/60">
                <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
                    <p className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/80 px-3 py-1.5 text-sm font-semibold text-brand shadow-sm">
                        <FontAwesomeIcon icon={faBookOpen} className="h-3.5 w-3.5" />
                        Blog iMenu
                    </p>
                    <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-6xl">
                        Decisões melhores para o seu restaurante
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
                        Guias feitos para usar, não apenas para ler. Encontre contas
                        transparentes, exemplos reais, checklists e planos de ação para
                        cardápio, delivery, vendas e gestão.
                    </p>

                    <Link
                        href="/cardapio-digital"
                        className="group mt-10 grid overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-[0_24px_70px_-38px_rgba(234,88,12,0.55)] md:grid-cols-[1.08fr_0.92fr]"
                    >
                        <div className="flex flex-col justify-center p-7 sm:p-9">
                            <span className="w-fit rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
                                Artigo mais lido
                            </span>
                            <h2 className="mt-4 text-2xl font-extrabold leading-tight text-gray-950 group-hover:text-brand md:text-3xl">
                                Os 5 melhores cardápios digitais grátis do Brasil
                            </h2>
                            <p className="mt-4 leading-7 text-gray-600">
                                Uma comparação direta entre plataformas, modelos de cobrança
                                e os recursos que realmente importam na rotina do restaurante.
                            </p>
                            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-brand">
                                Ler comparação
                                <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                        <div className="relative min-h-[260px] overflow-hidden border-t border-orange-100 bg-orange-50 md:border-l md:border-t-0">
                            <Image
                                src="/images/Top-5-Cardapios-Digitais.png"
                                alt="Comparação dos cinco melhores cardápios digitais gratuitos do Brasil"
                                fill
                                priority
                                sizes="(max-width: 768px) 100vw, 460px"
                                className="object-cover"
                            />
                        </div>
                    </Link>
                </div>
            </header>

            <section className="mx-auto max-w-6xl px-6 py-14 md:py-20" aria-labelledby="latest-guides-title">
                <div className="max-w-3xl">
                    <p className="font-semibold text-brand">Guias aprofundados</p>
                    <h2 id="latest-guides-title" className="mt-2 text-3xl font-extrabold text-gray-950">
                        Resolva uma decisão da operação
                    </h2>
                    <p className="mt-4 leading-7 text-gray-600">
                        Cada conteúdo termina com uma ação prática: uma conta, um processo
                        para copiar ou um teste que você consegue rodar no restaurante.
                    </p>
                </div>

                <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {BLOG_ARTICLES.map((article, index) => (
                        <Link
                            key={article.slug}
                            href={getBlogArticlePath(article.slug)}
                            className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={articleIcons[index]} className="h-5 w-5" />
                            </span>
                            <span className="mt-5 text-xs font-bold uppercase tracking-wide text-brand">
                                {article.category}
                            </span>
                            <h3 className="mt-2 text-xl font-bold leading-7 text-gray-950 group-hover:text-brand">
                                {article.shortTitle}
                            </h3>
                            <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">{article.excerpt}</p>
                            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                                Ler guia · {article.readingTime.replace(" de leitura", "")}
                                <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="border-y border-gray-200 bg-gray-50">
                <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
                    <h2 className="text-2xl font-bold text-gray-950 md:text-3xl">Biblioteca iMenu</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-gray-600">
                        Comparativos e conteúdos essenciais que já ajudam restaurantes a
                        escolher um cardápio digital e organizar pedidos.
                    </p>
                    <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {EXISTING_BLOG_PAGES.map((article) => (
                            <Link
                                key={article.path}
                                href={article.path}
                                className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-sm"
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-brand">{article.category}</span>
                                <h3 className="mt-2 font-bold leading-6 text-gray-950 group-hover:text-brand">{article.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-gray-600">{article.excerpt}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
                <RestaurantToolsCta title="Do aprendizado para a operação" />
            </section>

            <section className="border-t border-gray-200 bg-gray-50">
                <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="font-semibold text-brand">Use agora</p>
                            <h2 className="mt-2 text-2xl font-bold text-gray-950 md:text-3xl">
                                Ferramentas para colocar em prática
                            </h2>
                        </div>
                        <Link href="/ferramentas" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand hover:underline">
                            Ver todas as ferramentas
                            <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="mt-7 grid gap-4 md:grid-cols-3">
                        {RESTAURANT_TOOLS.slice(0, 3).map((tool) => (
                            <Link
                                key={tool.slug}
                                href={getRestaurantToolPath(tool.slug)}
                                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                    <RestaurantToolIcon tool={tool.slug} className="h-4 w-4" />
                                </span>
                                <h3 className="mt-4 font-bold leading-6 text-gray-950 group-hover:text-brand">
                                    {tool.name}
                                </h3>
                                <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
                                    {tool.introduction}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </article>
    );
}

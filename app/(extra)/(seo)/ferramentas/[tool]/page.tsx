import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCalculator,
    faCheck,
    faChevronDown,
    faCircleQuestion,
    faLightbulb,
} from "@fortawesome/free-solid-svg-icons";

import RestaurantToolRenderer from "@/components/common/restaurant-tools/RestaurantToolRenderer";
import RestaurantToolIcon from "@/components/common/restaurant-tools/RestaurantToolIcon";
import RestaurantToolsCta from "@/components/common/restaurant-tools/RestaurantToolsCta";
import {
    getRestaurantTool,
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";

const SITE_URL = "https://www.imenuapp.com.br";

type ToolPageProps = {
    params: Promise<{ tool: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
    return RESTAURANT_TOOLS.map((tool) => ({ tool: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
    const { tool: slug } = await params;
    const tool = getRestaurantTool(slug);
    if (!tool) return { title: "Ferramenta não encontrada | iMenu", robots: { index: false, follow: false } };

    const canonical = `${SITE_URL}${getRestaurantToolPath(tool.slug)}`;
    return {
        title: `${tool.title} | iMenu`,
        description: tool.metaDescription,
        alternates: { canonical },
        robots: { index: true, follow: true },
        openGraph: {
            type: "website",
            locale: "pt_BR",
            siteName: "iMenu",
            url: canonical,
            title: tool.title,
            description: tool.metaDescription,
        },
    };
}

export default async function ToolPage({ params }: ToolPageProps) {
    const { tool: slug } = await params;
    const tool = getRestaurantTool(slug);
    if (!tool) notFound();

    const canonical = `${SITE_URL}${getRestaurantToolPath(tool.slug)}`;
    const currentIndex = RESTAURANT_TOOLS.findIndex((candidate) => candidate.slug === tool.slug);
    const related = [1, 2, 3].map(
        (offset) => RESTAURANT_TOOLS[(currentIndex + offset) % RESTAURANT_TOOLS.length]
    );
    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: tool.name,
            description: tool.metaDescription,
            url: canonical,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: "pt-BR",
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tool.faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "iMenu", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Ferramentas", item: `${SITE_URL}/ferramentas` },
                { "@type": "ListItem", position: 3, name: tool.name, item: canonical },
            ],
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

            <header className="border-b border-gray-200 bg-gray-50">
                <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
                    <nav aria-label="Navegação estrutural" className="text-sm text-gray-500">
                        <Link href="/ferramentas" className="hover:text-brand hover:underline">Ferramentas</Link>
                        <span aria-hidden="true" className="mx-2">/</span>
                        <span>{tool.name}</span>
                    </nav>
                    <p className="mt-6 inline-flex items-center gap-2 font-semibold text-brand">
                        <RestaurantToolIcon tool={tool.slug} className="h-4 w-4" />
                        Ferramenta gratuita para restaurantes
                    </p>
                    <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-5xl">
                        {tool.title}
                    </h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                        {tool.introduction}
                    </p>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14" aria-label={tool.name}>
                <RestaurantToolRenderer tool={tool.slug} />
            </section>

            <div className="mx-auto max-w-4xl space-y-14 px-6 pb-16 pt-6 md:pb-24">
                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-950">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <FontAwesomeIcon icon={faCalculator} className="h-4 w-4" />
                        </span>
                        {tool.calculationTitle}
                    </h2>
                    <p className="mt-4 leading-7 text-gray-600">{tool.calculation}</p>
                    {tool.slug === "calculadora-taxas-ifood" && (
                        <p className="mt-3 text-sm leading-6 text-gray-500">
                            Os presets foram baseados nas condições padrão publicadas pelo próprio iFood. Consulte sempre as condições atuais da sua loja na página oficial de {" "}
                            <a href="https://parceiros.ifood.com.br/restaurante/como-funciona/entregas" target="_blank" rel="noreferrer" className="text-brand underline">
                                planos e entregas para restaurantes
                            </a>.
                        </p>
                    )}
                </section>

                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-950">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <FontAwesomeIcon icon={faLightbulb} className="h-4 w-4" />
                        </span>
                        Como usar melhor o resultado
                    </h2>
                    <ul className="mt-4 space-y-3">
                        {tool.practicalTips.map((tip) => (
                            <li key={tip} className="flex gap-3 leading-7 text-gray-600">
                                <span aria-hidden="true" className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                                    <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
                                </span>
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-950">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <FontAwesomeIcon icon={faCircleQuestion} className="h-4 w-4" />
                        </span>
                        Perguntas frequentes
                    </h2>
                    <div className="mt-5 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-5">
                        {tool.faq.map((item) => (
                            <details key={item.question} className="group py-5">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                                    {item.question}
                                    <FontAwesomeIcon
                                        aria-hidden="true"
                                        icon={faChevronDown}
                                        className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <p className="mt-3 pr-8 text-sm leading-6 text-gray-600">{item.answer}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-bold text-gray-950">Outras ferramentas úteis</h2>
                        <Link
                            href="/ferramentas"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
                        >
                            Ver todas as ferramentas
                            <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {related.map((relatedTool) => (
                            <Link
                                key={relatedTool.slug}
                                href={getRestaurantToolPath(relatedTool.slug)}
                                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-800 transition hover:border-brand/40 hover:text-brand"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                    <RestaurantToolIcon tool={relatedTool.slug} className="h-4 w-4" />
                                </span>
                                <span>{relatedTool.name}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                <RestaurantToolsCta title="Transforme o resultado em pedidos" />
            </div>
        </article>
    );
}

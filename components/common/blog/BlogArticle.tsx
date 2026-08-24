import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faBookOpen,
    faCalculator,
    faCheck,
    faCircleInfo,
    faClock,
    faLightbulb,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

import RestaurantToolsCta from "@/components/common/restaurant-tools/RestaurantToolsCta";
import {
    BLOG_ARTICLES,
    BLOG_SITE_URL,
    type BlogArticleDefinition,
    getBlogArticlePath,
} from "@/lib/seo/blogArticles";

type ArticleSectionLink = {
    id: string;
    label: string;
};

type ArticleFaq = {
    question: string;
    answer: string;
};

type BlogArticleProps = {
    article: BlogArticleDefinition;
    icon: IconDefinition;
    takeaways: string[];
    sections: ArticleSectionLink[];
    faq: ArticleFaq[];
    relatedSlugs: string[];
    ctaTitle: string;
    children: React.ReactNode;
};

function formatArticleDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
}

export default function BlogArticle({
    article,
    icon,
    takeaways,
    sections,
    faq,
    relatedSlugs,
    ctaTitle,
    children,
}: BlogArticleProps) {
    const canonical = `${BLOG_SITE_URL}${getBlogArticlePath(article.slug)}`;
    const relatedArticles = relatedSlugs
        .map((slug) => BLOG_ARTICLES.find((candidate) => candidate.slug === slug))
        .filter((candidate): candidate is BlogArticleDefinition => Boolean(candidate));
    const usesQrCodeMesaHero = article.slug === "cardapio-digital-qr-code-restaurante";
    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: article.title,
            description: article.metaDescription,
            url: canonical,
            mainEntityOfPage: canonical,
            inLanguage: "pt-BR",
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            author: {
                "@type": "Organization",
                name: "Equipe iMenu",
                url: BLOG_SITE_URL,
            },
            publisher: {
                "@type": "Organization",
                name: "iMenu",
                url: BLOG_SITE_URL,
            },
        },
        {
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
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "iMenu", item: BLOG_SITE_URL },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${BLOG_SITE_URL}/blog` },
                { "@type": "ListItem", position: 3, name: article.shortTitle, item: canonical },
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

            <header className="overflow-hidden border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50/60">
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-[1.18fr_0.82fr] md:py-20">
                    <div className="min-w-0">
                        <nav aria-label="Navegação estrutural" className="text-sm text-gray-500">
                            <Link href="/blog" className="hover:text-brand hover:underline">Blog</Link>
                            <span aria-hidden="true" className="mx-2">/</span>
                            <span>{article.category}</span>
                        </nav>

                        <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/80 px-3 py-1.5 text-sm font-semibold text-brand shadow-sm">
                            <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />
                            Guia prático para restaurantes
                        </p>
                        <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 md:text-5xl">
                            {article.title}
                        </h1>
                        <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
                            {article.excerpt}
                        </p>
                        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
                            <span>Por Equipe iMenu</span>
                            <span className="inline-flex items-center gap-2">
                                <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-brand" />
                                {article.readingTime}
                            </span>
                            <span>Atualizado em {formatArticleDate(article.updatedAt)}</span>
                        </div>
                    </div>

                    {usesQrCodeMesaHero ? (
                        <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-white p-3 shadow-[0_24px_70px_-38px_rgba(234,88,12,0.55)]">
                            <img
                                src="/images/QRCodeMesa.png"
                                alt="Cliente usando o celular para escanear um QR Code na mesa do restaurante"
                                className="block h-auto max-h-[360px] w-full rounded-2xl object-contain"
                            />
                        </div>
                    ) : (
                        <div className="relative overflow-hidden rounded-3xl border border-orange-200 bg-white p-6 shadow-[0_24px_70px_-38px_rgba(234,88,12,0.55)] sm:p-8">
                            <div aria-hidden="true" className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
                            <div className="relative">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20">
                                    <FontAwesomeIcon icon={icon} className="h-5 w-5" />
                                </span>
                                <h2 className="mt-5 text-xl font-bold text-gray-950">Ao terminar, você terá</h2>
                                <ul className="mt-5 space-y-4">
                                    {takeaways.map((takeaway) => (
                                        <li key={takeaway} className="flex gap-3 text-sm leading-6 text-gray-600">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                                                <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
                                            </span>
                                            <span>{takeaway}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-20">
                <aside className="hidden lg:block">
                    <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-bold text-gray-950">Neste guia</p>
                        <nav aria-label="Índice do artigo" className="mt-4">
                            <ol className="space-y-3 text-sm leading-5 text-gray-600">
                                {sections.map((section) => (
                                    <li key={section.id}>
                                        <a href={`#${section.id}`} className="transition hover:text-brand">
                                            {section.label}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                        <Link
                            href="/ferramentas"
                            className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-5 text-sm font-semibold text-brand hover:underline"
                        >
                            <FontAwesomeIcon icon={faCalculator} className="h-3.5 w-3.5" />
                            Ferramentas grátis
                        </Link>
                    </div>
                </aside>

                <div className="min-w-0">
                    <div className={`space-y-16 ${usesQrCodeMesaHero ? "[&>figure:first-child]:hidden" : ""}`}>
                        {children}
                    </div>

                    <section className="mt-16 scroll-mt-24" id="perguntas-frequentes">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={faCircleInfo} className="h-4 w-4" />
                            </span>
                            <h2 className="text-2xl font-bold text-gray-950 md:text-3xl">Perguntas frequentes</h2>
                        </div>
                        <div className="mt-6 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-5">
                            {faq.map((item) => (
                                <details key={item.question} className="group py-5">
                                    <summary className="cursor-pointer list-none pr-8 font-semibold text-gray-900">
                                        {item.question}
                                    </summary>
                                    <p className="mt-3 max-w-3xl pr-6 leading-7 text-gray-600">{item.answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>

                    {relatedArticles.length > 0 && (
                        <section className="mt-16" aria-labelledby="related-articles-title">
                            <h2 id="related-articles-title" className="text-2xl font-bold text-gray-950">
                                Continue com um próximo passo
                            </h2>
                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                {relatedArticles.map((related) => (
                                    <Link
                                        key={related.slug}
                                        href={getBlogArticlePath(related.slug)}
                                        className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                                    >
                                        <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                                            {related.category}
                                        </span>
                                        <h3 className="mt-2 flex-1 font-bold leading-6 text-gray-950 group-hover:text-brand">
                                            {related.shortTitle}
                                        </h3>
                                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                                            Ler guia
                                            <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="mt-16">
                        <RestaurantToolsCta title={ctaTitle} />
                    </div>
                </div>
            </div>
        </article>
    );
}

export function BlogSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24">
            <h2 className="text-2xl font-bold leading-tight text-gray-950 md:text-3xl">{title}</h2>
            <div className="mt-5 space-y-5 leading-8 text-gray-600">{children}</div>
        </section>
    );
}

export function BlogSubheading({ children }: { children: React.ReactNode }) {
    return <h3 className="pt-2 text-xl font-bold leading-7 text-gray-900">{children}</h3>;
}

export function BlogCallout({
    title,
    variant = "info",
    children,
}: {
    title: string;
    variant?: "info" | "tip" | "warning";
    children: React.ReactNode;
}) {
    const styles = {
        info: { box: "border-blue-200 bg-blue-50/70", icon: "bg-blue-100 text-blue-700", definition: faCircleInfo },
        tip: { box: "border-orange-200 bg-orange-50/70", icon: "bg-orange-100 text-brand", definition: faLightbulb },
        warning: { box: "border-amber-200 bg-amber-50/80", icon: "bg-amber-100 text-amber-700", definition: faTriangleExclamation },
    }[variant];

    return (
        <div className={`rounded-2xl border p-5 sm:p-6 ${styles.box}`}>
            <div className="flex gap-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
                    <FontAwesomeIcon icon={styles.definition} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="font-bold text-gray-950">{title}</p>
                    <div className="mt-2 text-sm leading-6 text-gray-700">{children}</div>
                </div>
            </div>
        </div>
    );
}

export function BlogChecklist({ items }: { items: React.ReactNode[] }) {
    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item, index) => (
                <li key={index} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <FontAwesomeIcon icon={faCheck} className="h-2.5 w-2.5" />
                    </span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

export function BlogSteps({
    items,
}: {
    items: Array<{ title: string; description: React.ReactNode }>;
}) {
    return (
        <ol className="space-y-4">
            {items.map((item, index) => (
                <li key={item.title} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
                        {index + 1}
                    </span>
                    <div>
                        <h3 className="font-bold text-gray-950">{item.title}</h3>
                        <div className="mt-1 text-sm leading-6 text-gray-600">{item.description}</div>
                    </div>
                </li>
            ))}
        </ol>
    );
}

export function BlogToolLink({
    href,
    title,
    description,
}: {
    href: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-5 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-5 transition hover:border-brand/50 hover:shadow-md"
        >
            <span className="flex min-w-0 items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                    <FontAwesomeIcon icon={faCalculator} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                    <span className="block font-bold text-gray-950 group-hover:text-brand">{title}</span>
                    <span className="mt-1 block text-sm leading-5 text-gray-600">{description}</span>
                </span>
            </span>
            <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4 shrink-0 text-brand transition-transform group-hover:translate-x-1" />
        </Link>
    );
}

export function BlogReadingNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-3 rounded-xl border-l-4 border-brand bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
            <FontAwesomeIcon icon={faBookOpen} className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
            <div>{children}</div>
        </div>
    );
}
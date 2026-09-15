"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faBellConcierge,
    faChartLine,
    faComments,
    faMoneyBillTransfer,
    faReceipt,
    faStore,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import {
    BLOG_ARTICLES,
    EXISTING_BLOG_PAGES,
    getBlogArticlePath,
} from "@/lib/seo/blogArticles";
import { COMPARISON_PAGES } from "@/lib/seo/comparisonPages";

const INITIAL_VISIBLE_POSTS = 6;
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

export function BlogArticleGrid() {
    const [showAll, setShowAll] = useState(false);
    const visibleArticles = showAll
        ? BLOG_ARTICLES
        : BLOG_ARTICLES.slice(0, INITIAL_VISIBLE_POSTS);

    return (
        <>
            <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {visibleArticles.map((article, index) => (
                    <Link
                        key={article.slug}
                        href={getBlogArticlePath(article.slug)}
                        className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <FontAwesomeIcon
                                icon={articleIcons[index % articleIcons.length]}
                                className="h-5 w-5"
                            />
                        </span>
                        <span className="mt-5 text-xs font-bold uppercase tracking-wide text-brand">
                            {article.category}
                        </span>
                        <h3 className="mt-2 text-xl font-bold leading-7 text-gray-950 group-hover:text-brand">
                            {article.shortTitle}
                        </h3>
                        <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">
                            {article.excerpt}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                            Ler guia · {article.readingTime.replace(" de leitura", "")}
                            <FontAwesomeIcon
                                icon={faArrowRight}
                                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                            />
                        </span>
                    </Link>
                ))}
            </div>

            {!showAll && BLOG_ARTICLES.length > INITIAL_VISIBLE_POSTS && (
                <div className="mt-8 flex justify-center">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowAll(true)}
                    >
                        Ver mais
                    </Button>
                </div>
            )}
        </>
    );
}

export function BlogLibraryGrid() {
    const [showAll, setShowAll] = useState(false);
    const libraryPages = [
        ...EXISTING_BLOG_PAGES,
        ...COMPARISON_PAGES.map((page) => ({
            path: `/${page.slug}`,
            title: `iMenu vs ${page.competitor}`,
            excerpt: page.excerpt,
            category: "Comparativo" as const,
        })),
    ];
    const visiblePages = showAll
        ? libraryPages
        : libraryPages.slice(0, INITIAL_VISIBLE_POSTS);

    return (
        <>
            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visiblePages.map((article) => (
                    <Link
                        key={article.path}
                        href={article.path}
                        className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-sm"
                    >
                        <span className="text-xs font-bold uppercase tracking-wide text-brand">
                            {article.category}
                        </span>
                        <h3 className="mt-2 font-bold leading-6 text-gray-950 group-hover:text-brand">
                            {article.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                            {article.excerpt}
                        </p>
                    </Link>
                ))}
            </div>

            {!showAll && libraryPages.length > INITIAL_VISIBLE_POSTS && (
                <div className="mt-8 flex justify-center">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowAll(true)}
                    >
                        Ver mais
                    </Button>
                </div>
            )}
        </>
    );
}

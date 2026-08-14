import type { Metadata } from "next";
import Link from "next/link";

import {
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";

const SITE_URL = "https://www.imenuapp.com.br";

export const metadata: Metadata = {
    title: "Ferramentas grátis para restaurantes e delivery | iMenu",
    description:
        "Calculadoras de CMV, margem, ticket médio, preço, comissão e iFood, além de geradores de QR Code, cardápio e descrição com IA.",
    alternates: { canonical: `${SITE_URL}/ferramentas` },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "pt_BR",
        siteName: "iMenu",
        url: `${SITE_URL}/ferramentas`,
        title: "Ferramentas grátis para restaurantes e delivery",
        description:
            "Faça contas importantes da operação e crie materiais para o seu cardápio sem cadastro e sem custo.",
    },
};

export default function RestaurantToolsPage() {
    const itemList = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Ferramentas gratuitas para restaurantes",
        numberOfItems: RESTAURANT_TOOLS.length,
        itemListElement: RESTAURANT_TOOLS.map((tool, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: tool.name,
            url: `${SITE_URL}${getRestaurantToolPath(tool.slug)}`,
        })),
    };

    return (
        <article className="w-full">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
                }}
            />

            <header className="border-b border-gray-200 bg-gray-50">
                <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                    <p className="font-semibold text-brand">100% grátis e sem cadastro</p>
                    <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-6xl">
                        Ferramentas para quem administra restaurante e delivery
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
                        Calcule custos, preços e margens com clareza. Gere QR Code,
                        cardápio e descrições de produtos. Tudo funciona direto no
                        navegador e entrega um resultado útil na hora.
                    </p>
                </div>
            </header>

            <section className="mx-auto max-w-6xl px-6 py-14 md:py-20" aria-labelledby="tools-title">
                <div className="max-w-3xl">
                    <h2 id="tools-title" className="text-2xl font-bold text-gray-950 md:text-3xl">
                        Escolha uma ferramenta
                    </h2>
                    <p className="mt-3 leading-7 text-gray-600">
                        Os cálculos são transparentes, os campos podem ser ajustados à
                        realidade da sua operação e cada página explica a fórmula usada.
                    </p>
                </div>

                <div className="mt-9 grid gap-5 md:grid-cols-2">
                    {RESTAURANT_TOOLS.map((tool, index) => (
                        <Link
                            key={tool.slug}
                            href={getRestaurantToolPath(tool.slug)}
                            className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                                {index + 1}
                            </span>
                            <h3 className="mt-4 text-xl font-bold text-gray-950 group-hover:text-brand">
                                {tool.name}
                            </h3>
                            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
                                {tool.introduction}
                            </p>
                            <span className="mt-5 text-sm font-semibold text-brand">
                                Usar ferramenta grátis →
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-4xl px-6 pb-16 md:pb-24">
                <div className="rounded-2xl bg-gray-950 p-7 text-white md:p-10">
                    <h2 className="text-2xl font-bold">Do cálculo para a operação</h2>
                    <p className="mt-3 max-w-2xl leading-7 text-gray-300">
                        Você também pode criar seu cardápio, receber pedidos e gerenciar
                        tudo gratuitamente no iMenu.
                    </p>
                    <Link
                        href="/"
                        data-seo-home-link
                        className="mt-6 inline-flex rounded-md bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand/90"
                    >
                        Conhecer o iMenu
                    </Link>
                </div>
            </section>
        </article>
    );
}

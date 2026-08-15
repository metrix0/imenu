import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";

import RestaurantToolIcon from "@/components/common/restaurant-tools/RestaurantToolIcon";
import RestaurantToolsCta from "@/components/common/restaurant-tools/RestaurantToolsCta";
import {
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";

const SITE_URL = "https://www.imenuapp.com.br";

export const metadata: Metadata = {
    title: "Ferramentas grátis para restaurantes e delivery | iMenu",
    description:
        "Calculadoras de CMV, margem, ticket médio, preço, comissão e iFood, além de QR Code, rascunho de cardápio e descrição com IA.",
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

            <header className="border-b border-gray-200 bg-gradient-to-br from-orange-50 via-white to-white">
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 md:grid-cols-[1.15fr_0.85fr] md:py-20">
                    <div>
                        <p className="font-semibold text-brand">100% grátis e sem cadastro</p>
                        <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-gray-950 md:text-6xl">
                            Ferramentas para quem administra restaurante e delivery
                        </h1>
                        <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
                            Calcule custos, preços e margens com clareza. Gere QR Code,
                            rascunhos de cardápio e descrições de produtos. Tudo funciona
                            direto no navegador e entrega um resultado útil na hora.
                        </p>
                    </div>
                    <div className="relative mx-auto h-[330px] w-full max-w-sm overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-xl shadow-orange-100/70 md:h-[430px]">
                        <Image
                            src="/images/Menu_Mockup_2.png"
                            alt="Exemplo de cardápio digital para restaurante"
                            fill
                            priority
                            sizes="(max-width: 768px) 90vw, 384px"
                            className="object-cover object-top"
                        />
                    </div>
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
                    {RESTAURANT_TOOLS.map((tool) => (
                        <Link
                            key={tool.slug}
                            href={getRestaurantToolPath(tool.slug)}
                            className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                <RestaurantToolIcon tool={tool.slug} className="h-5 w-5" />
                            </span>
                            <h3 className="mt-4 text-xl font-bold text-gray-950 group-hover:text-brand">
                                {tool.name}
                            </h3>
                            <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
                                {tool.introduction}
                            </p>
                            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                                Usar ferramenta grátis
                                <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-4xl px-6 pb-16 md:pb-24">
                <RestaurantToolsCta title="Do cálculo para a operação" />
            </section>
        </article>
    );
}

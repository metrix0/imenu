import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
    getRestaurantDirectory,
    PublicRestaurantCity,
} from "@/lib/seo/restaurantDirectory";

export const revalidate = 3600;

const SITE_URL = "https://www.imenuapp.com.br";

type CityPageProps = {
    params: Promise<{ city: string }>;
};

const getCity = cache(
    async (citySlug: string): Promise<PublicRestaurantCity | null> => {
        const cities = await getRestaurantDirectory();
        return cities.find((city) => city.slug === citySlug) || null;
    }
);

function getLocation(city: PublicRestaurantCity): string {
    return city.name + (city.state ? " - " + city.state : "");
}

function getDescription(city: PublicRestaurantCity): string {
    const location = getLocation(city);
    const menuLabel =
        city.restaurants.length === 1 ? "cardápio" : "cardápios";

    return (
        "Encontre " +
        city.restaurants.length +
        " " +
        menuLabel +
        " de restaurantes em " +
        location +
        ". Veja preços, opções de delivery e faça seu pedido online pelo iMenu."
    );
}

export async function generateMetadata({
    params,
}: CityPageProps): Promise<Metadata> {
    const { city: citySlug } = await params;
    const city = await getCity(citySlug);

    if (!city) {
        return {
            title: "Cidade não encontrada | iMenu",
            robots: { index: false, follow: false },
        };
    }

    const location = getLocation(city);
    const title =
        "Restaurantes em " +
        location +
        " | Cardápios e delivery";
    const description = getDescription(city);
    const canonicalUrl =
        SITE_URL + "/restaurantes/" + encodeURIComponent(city.slug);

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
            },
        },
        openGraph: {
            type: "website",
            locale: "pt_BR",
            siteName: "iMenu",
            url: canonicalUrl,
            title,
            description,
        },
    };
}

export default async function CityPage({ params }: CityPageProps) {
    const { city: citySlug } = await params;
    const city = await getCity(citySlug);

    if (!city) {
        notFound();
    }

    const location = getLocation(city);
    const itemListData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Cardápios de restaurantes em " + location,
        numberOfItems: city.restaurants.length,
        itemListElement: city.restaurants.map((restaurant, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: restaurant.name,
            url:
                SITE_URL +
                "/" +
                encodeURIComponent(restaurant.slug),
        })),
    };

    return (
        <article className="mx-auto min-h-[60vh] w-full max-w-6xl px-6 py-14 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(itemListData).replace(
                        /</g,
                        "\\u003c"
                    ),
                }}
            />

            <header className="max-w-3xl">
                <p className="mb-3 font-semibold text-brand">
                    Cardápios digitais
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
                    Restaurantes em {location}
                </h1>
                <p className="mt-5 text-base leading-relaxed text-gray-600 md:text-lg">
                    {getDescription(city)}
                </p>
            </header>

            <section
                aria-labelledby="restaurant-list-title"
                className="mt-12"
            >
                <h2
                    id="restaurant-list-title"
                    className="mb-6 text-xl font-bold text-gray-900 md:text-2xl"
                >
                    Cardápios disponíveis
                </h2>

                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {city.restaurants.map((restaurant) => (
                        <li key={restaurant.slug}>
                            <Link
                                href={"/" + restaurant.slug}
                                className="group flex h-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
                            >
                                <div>
                                    <h3 className="font-semibold text-gray-900 group-hover:text-brand">
                                        {restaurant.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Ver cardápio e fazer pedido
                                    </p>
                                </div>
                                <span
                                    aria-hidden="true"
                                    className="text-lg text-brand"
                                >
                                    →
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </article>
    );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getRestaurantCityLinks } from "@/lib/seo/restaurantDirectory";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Restaurantes por cidade | iMenu",
    description: "Encontre cardápios de restaurantes por cidade e faça seu pedido online pelo iMenu.",
    alternates: { canonical: "https://www.imenuapp.com.br/restaurantes" },
};

export default async function RestaurantDirectoryPage() {
    const cities = await getRestaurantCityLinks();

    return (
        <article className="mx-auto min-h-[60vh] w-full max-w-6xl px-6 py-14 md:py-20">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
                Restaurantes por cidade
            </h1>

            {cities.length > 0 ? (
                <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cities.map((city) => (
                        <li key={city.slug}>
                            <Link
                                href={`/restaurantes/${city.slug}`}
                                prefetch={false}
                                className="group flex h-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
                            >
                                <div>
                                    <h2 className="font-semibold text-gray-900 group-hover:text-brand">
                                        {city.name}{city.state ? `, ${city.state}` : ""}
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {city.menuCount} {city.menuCount === 1 ? "cardápio" : "cardápios"}
                                    </p>
                                </div>
                                <span aria-hidden="true" className="text-lg text-brand">→</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-5 text-gray-600">Nenhum cardápio disponível no momento.</p>
            )}
        </article>
    );
}

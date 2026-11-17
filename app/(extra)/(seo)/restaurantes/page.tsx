import type { Metadata } from "next";
import RestaurantCityList from "./RestaurantCityList";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Restaurantes por cidade | iMenu",
    description: "Encontre cardápios de restaurantes por cidade e faça seu pedido online pelo iMenu.",
    alternates: { canonical: "https://www.imenuapp.com.br/restaurantes" },
};

export default function RestaurantDirectoryPage() {
    return (
        <article className="mx-auto min-h-[60vh] w-full max-w-6xl px-6 py-14 md:py-20">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
                Restaurantes por cidade
            </h1>

            <RestaurantCityList />
        </article>
    );
}

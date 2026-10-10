import type { Metadata } from "next";
import MenuPage from "@/app/[slug]/page";
import { getPublicMenuRestaurant } from "@/app/[slug]/restaurant-data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const restaurant = await getPublicMenuRestaurant(slug);
    return {
        title: `${restaurant?.name || "Cardápio"} | Cardápio Vitrine`,
        description: "Consulte produtos e preços. Cardápio exclusivo para visualização, sem pedidos.",
        alternates: { canonical: `https://www.imenuapp.com.br/${encodeURIComponent(slug)}` },
        robots: { index: false, follow: false },
    };
}

export default async function VitrinePage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ p?: string }>;
}) {
    const [{ slug }, query] = await Promise.all([params, searchParams]);
    return (
        <MenuPage
            params={Promise.resolve({ slug })}
            searchParams={Promise.resolve({ p: query.p, origem: "vitrine" })}
        />
    );
}

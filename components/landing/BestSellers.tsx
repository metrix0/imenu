"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface BestSeller {
    id: string;
    name: string;
    url_slug: string;
    logo_url: string | null;
    order_count: number;
}

export default function BestSellers() {
    const router = useRouter();
    const [restaurants, setRestaurants] = useState<BestSeller[]>([]);

    useEffect(() => {
        let active = true;

        void fetch("/api/restaurants/best-sellers")
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (active && Array.isArray(payload?.restaurants)) {
                    setRestaurants(payload.restaurants);
                }
            })
            .catch(() => {
                // The ranking is optional and must not block the landing page.
            });

        return () => {
            active = false;
        };
    }, []);

    if (restaurants.length === 0) return null;

    return (
        <section className="px-6 py-16 sm:px-8 md:px-20 2xl:px-32 2xl:py-24">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand 2xl:text-base">
                        RESTAURANTES
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900 md:text-4xl 2xl:text-5xl">
                        Mais Vendas na Semana
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:gap-7">
                    {restaurants.map((restaurant, index) => (
                        <article
                            key={restaurant.id}
                            className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex md:flex-col md:text-center 2xl:p-7"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand">
                                {index + 1}º
                            </span>

                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-50 2xl:h-20 2xl:w-20">
                                {restaurant.logo_url ? (
                                    <img
                                        src={restaurant.logo_url}
                                        alt={`Logo de ${restaurant.name}`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-brand">
                                        {restaurant.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 md:flex-none">
                                <h3 className="truncate text-lg font-bold text-gray-900 2xl:text-xl">
                                    {restaurant.name}
                                </h3>
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => router.push(`/${restaurant.url_slug}`)}
                                className="col-span-3 w-full whitespace-nowrap px-4 py-2 md:w-auto"
                            >
                                Ver cardápio
                            </Button>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

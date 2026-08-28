"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "@/components/ui/Button";
import { icons } from "@/lib/utils/fontawesome";

interface BestSeller {
    id: string;
    name: string;
    url_slug: string;
    logo_url: string | null;
    order_count: number;
}

type LandingStats = {
    total_restaurants: number;
    total_orders: number;
    total_gmv_cents: number;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

export default function BestSellers() {
    const router = useRouter();
    const [restaurants, setRestaurants] = useState<BestSeller[]>([]);
    const [stats, setStats] = useState<LandingStats | null>(null);

    useEffect(() => {
        let active = true;

        void fetch("/api/restaurants/best-sellers")
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (!active) return;

                if (Array.isArray(payload?.restaurants)) {
                    setRestaurants(payload.restaurants);
                }
                if (payload?.stats) {
                    setStats(payload.stats);
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

                {stats && (
                    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 2xl:gap-6">
                        <div className="group relative overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-white via-white to-orange-50/70 px-5 py-5 shadow-[0_18px_45px_-28px_rgba(181,67,20,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_22px_50px_-26px_rgba(181,67,20,0.65)] 2xl:px-7 2xl:py-6">
                            <div aria-hidden="true" className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
                            <div className="relative flex items-center gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-lg text-brand ring-1 ring-brand/10 2xl:h-14 2xl:w-14 2xl:text-xl">
                                    <FontAwesomeIcon icon={icons.faStore} />
                                </span>
                                <div className="min-w-0 text-left">
                                    <p className="text-2xl font-extrabold tracking-tight text-gray-900 2xl:text-[2rem]">
                                        {numberFormatter.format(stats.total_restaurants)}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-gray-500 2xl:text-base">
                                        restaurantes
                                    </p>
                                </div>
                            </div>
                            <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
                        </div>

                        <div className="group relative overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-white via-white to-orange-50/70 px-5 py-5 shadow-[0_18px_45px_-28px_rgba(181,67,20,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_22px_50px_-26px_rgba(181,67,20,0.65)] 2xl:px-7 2xl:py-6">
                            <div aria-hidden="true" className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
                            <div className="relative flex items-center gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-lg text-brand ring-1 ring-brand/10 2xl:h-14 2xl:w-14 2xl:text-xl">
                                    <FontAwesomeIcon icon={icons.faDollarSign} />
                                </span>
                                <div className="min-w-0 text-left">
                                    <p className="text-2xl font-extrabold tracking-tight text-gray-900 2xl:text-[2rem]">
                                        {currencyFormatter.format(stats.total_gmv_cents / 100)}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-gray-500 2xl:text-base">
                                        movimentados
                                    </p>
                                </div>
                            </div>
                            <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
                        </div>

                        <div className="group relative overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-white via-white to-orange-50/70 px-5 py-5 shadow-[0_18px_45px_-28px_rgba(181,67,20,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_22px_50px_-26px_rgba(181,67,20,0.65)] 2xl:px-7 2xl:py-6">
                            <div aria-hidden="true" className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
                            <div className="relative flex items-center gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-lg text-brand ring-1 ring-brand/10 2xl:h-14 2xl:w-14 2xl:text-xl">
                                    <FontAwesomeIcon icon={icons.faTicket} />
                                </span>
                                <div className="min-w-0 text-left">
                                    <p className="text-2xl font-extrabold tracking-tight text-gray-900 2xl:text-[2rem]">
                                        {numberFormatter.format(stats.total_orders)}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-gray-500 2xl:text-base">
                                        pedidos
                                    </p>
                                </div>
                            </div>
                            <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:gap-7">
                    {restaurants.map((restaurant, index) => (
                        <article
                            key={restaurant.id}
                            className="group relative grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-white via-white to-orange-50/70 p-5 shadow-[0_18px_45px_-28px_rgba(181,67,20,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_22px_50px_-26px_rgba(181,67,20,0.65)] md:flex md:flex-col md:text-center 2xl:p-7"
                        >
                            <div aria-hidden="true" className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-brand/10 blur-2xl" />
                            <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

                            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand/15 bg-white/80 text-xl font-extrabold tracking-tight text-brand shadow-[0_12px_28px_-18px_rgba(181,67,20,0.65)] ring-1 ring-brand/5 2xl:h-14 2xl:w-14 2xl:text-2xl">
                                <span aria-hidden="true" className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-brand/10 blur-md" />
                                <span className="relative">{index + 1}º</span>
                            </span>

                            <div className="relative z-10 h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-brand/15 bg-white shadow-sm ring-4 ring-white/80 2xl:h-20 2xl:w-20">
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

                            <div className="relative z-10 min-w-0 md:flex-none">
                                <h3 className="truncate text-lg font-extrabold tracking-tight text-gray-900 2xl:text-xl">
                                    {restaurant.name}
                                </h3>
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => router.push(`/${restaurant.url_slug}`)}
                                className="relative z-10 col-span-3 w-full whitespace-nowrap px-4 py-2 shadow-sm md:w-auto"
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

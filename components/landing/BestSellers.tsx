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
        <section className="px-6 py-16 sm:px-8 md:px-20 min-[1400px]:px-24 min-[1400px]:py-20 2xl:px-32 2xl:py-24">
            <div className="mx-auto max-w-6xl min-[1400px]:max-w-7xl">
                <div className="mb-8 text-center min-[1400px]:mb-10">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand min-[1400px]:text-sm 2xl:text-base">
                        RESTAURANTES
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900 md:text-4xl min-[1400px]:text-[2.75rem] 2xl:text-5xl">
                        Mais Vendas na Semana
                    </h2>
                </div>

                {stats && (
                    <div className="mb-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 sm:grid-cols-3 sm:divide-x sm:divide-gray-200 min-[1400px]:mb-10">
                        <div className="flex items-center gap-4 px-5 py-5 min-[1400px]:px-6 min-[1400px]:py-6 2xl:px-7">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base text-brand min-[1400px]:h-12 min-[1400px]:w-12 min-[1400px]:text-lg 2xl:text-lg">
                                <FontAwesomeIcon icon={icons.faStore} />
                            </span>
                            <div className="min-w-0 text-left">
                                <p className="text-2xl font-extrabold tracking-tight text-gray-900 min-[1400px]:text-[1.75rem] 2xl:text-[2rem]">
                                    +{numberFormatter.format(stats.total_restaurants)}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-gray-500 min-[1400px]:text-[0.95rem] 2xl:text-base">
                                    restaurantes
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-t border-gray-200 px-5 py-5 sm:border-t-0 min-[1400px]:px-6 min-[1400px]:py-6 2xl:px-7">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base text-brand min-[1400px]:h-12 min-[1400px]:w-12 min-[1400px]:text-lg 2xl:text-lg">
                                <FontAwesomeIcon icon={icons.faDollarSign} />
                            </span>
                            <div className="min-w-0 text-left">
                                <p className="text-2xl font-extrabold tracking-tight text-gray-900 min-[1400px]:text-[1.75rem] 2xl:text-[2rem]">
                                    +{currencyFormatter.format(stats.total_gmv_cents / 100)}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-gray-500 min-[1400px]:text-[0.95rem] 2xl:text-base">
                                    movimentados
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-t border-gray-200 px-5 py-5 sm:border-t-0 min-[1400px]:px-6 min-[1400px]:py-6 2xl:px-7">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base text-brand min-[1400px]:h-12 min-[1400px]:w-12 min-[1400px]:text-lg 2xl:text-lg">
                                <FontAwesomeIcon icon={icons.faTicket} />
                            </span>
                            <div className="min-w-0 text-left">
                                <p className="text-2xl font-extrabold tracking-tight text-gray-900 min-[1400px]:text-[1.75rem] 2xl:text-[2rem]">
                                    +{numberFormatter.format(stats.total_orders)}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-gray-500 min-[1400px]:text-[0.95rem] 2xl:text-base">
                                    pedidos
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 min-[1400px]:gap-5 2xl:gap-6">
                    {restaurants.map((restaurant, index) => (
                        <article
                            key={restaurant.id}
                            className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)] md:flex md:flex-col md:text-center min-[1400px]:p-6 2xl:p-7"
                        >
                            <span className="text-xl font-extrabold tracking-tight text-brand min-[1400px]:text-[1.375rem] 2xl:text-2xl">
                                {index + 1}º
                            </span>

                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white min-[1400px]:h-18 min-[1400px]:w-18 2xl:h-20 2xl:w-20">
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
                                <h3 className="truncate text-lg font-bold tracking-tight text-gray-900 min-[1400px]:text-[1.125rem] 2xl:text-xl">
                                    {restaurant.name}
                                </h3>
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => router.push(`/${restaurant.url_slug}`)}
                                className="col-span-3 w-full whitespace-nowrap !min-h-10 !rounded-lg !border !border-[#d93d00] !bg-[#d93d00] !px-[14px] !py-[9px] !text-[13px] !leading-5 !font-medium !text-white !shadow-none hover:!border-[#c43700] hover:!bg-[#c43700] focus:!ring-[#d93d00] md:mt-auto md:w-auto"
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
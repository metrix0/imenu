"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRestaurantDirectory } from "@/components/common/RestaurantDirectoryProvider";
import Dropdown from "@/components/ui/Dropdown";
import PanelAppearance from "@/components/ui/PanelAppearance";
import Pagination from "@/components/ui/Pagination";

const CITIES_PER_PAGE = 24;
const SORT_OPTIONS = [
    { value: "name", label: "Ordenar por nome" },
    { value: "quantity", label: "Ordenar por quantidade" },
];

export default function RestaurantCityList() {
    const cities = useRestaurantDirectory();
    const [order, setOrder] = useState<"name" | "quantity">("name");
    const [requestedPage, setPage] = useState(0);
    const sortControlsRef = useRef<HTMLDivElement>(null);

    if (cities.length === 0) {
        return <p className="mt-5 text-gray-600">Nenhum cardápio disponível no momento.</p>;
    }

    const sortedCities = order === "quantity"
        ? [...cities].sort((first, second) => second.menuCount - first.menuCount)
        : cities;
    const pageCount = Math.ceil(sortedCities.length / CITIES_PER_PAGE);
    const page = Math.min(requestedPage, pageCount - 1);
    const start = page * CITIES_PER_PAGE;
    const visibleCities = sortedCities.slice(start, start + CITIES_PER_PAGE);

    return (
        <>
            <div ref={sortControlsRef} className="mt-5 scroll-mt-4 sm:w-56">
                <PanelAppearance>
                    <Dropdown
                        aria-label="Ordenar restaurantes por cidade"
                        value={order}
                        options={SORT_OPTIONS}
                        onChange={(event) => {
                            const nextOrder = event.target.value === "quantity" ? "quantity" : "name";
                            if (nextOrder === order) return;
                            setOrder(nextOrder);
                            setPage(0);
                        }}
                    />
                </PanelAppearance>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleCities.map((city) => (
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

            {pageCount > 1 && (
                <Pagination
                    page={page}
                    pageCount={pageCount}
                    onChange={(nextPage) => {
                        if (nextPage === page) return;
                        setPage(nextPage);
                        sortControlsRef.current?.scrollIntoView({ block: "start" });
                    }}
                />
            )}
        </>
    );
}

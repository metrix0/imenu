"use client";

import { useState } from "react";
import Link from "next/link";
import { useRestaurantDirectory } from "@/components/common/RestaurantDirectoryProvider";
import Dropdown from "@/components/ui/Dropdown";

export default function RestaurantCityList() {
    const cities = useRestaurantDirectory();
    const [order, setOrder] = useState<"name" | "quantity">("name");

    if (cities.length === 0) {
        return <p className="mt-5 text-gray-600">Nenhum cardápio disponível no momento.</p>;
    }

    const sortedCities = order === "quantity"
        ? [...cities].sort((first, second) => second.menuCount - first.menuCount)
        : cities;

    return (
        <>
            <div className="mt-5 sm:w-fit">
                <Dropdown
                    aria-label="Ordenar restaurantes por cidade"
                    value={order}
                    onChange={(event) => setOrder(event.target.value === "quantity" ? "quantity" : "name")}
                >
                    <option value="name">Ordenar por nome</option>
                    <option value="quantity">Ordenar por quantidade</option>
                </Dropdown>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedCities.map((city) => (
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
        </>
    );
}

"use client";

import {
    createContext,
    ReactNode,
    useContext,
} from "react";

export type RestaurantCityLink = {
    slug: string;
    name: string;
    state: string | null;
    menuCount: number;
};

const RestaurantDirectoryContext = createContext<
    readonly RestaurantCityLink[]
>([]);

export default function RestaurantDirectoryProvider({
    children,
    cities,
}: {
    children: ReactNode;
    cities: RestaurantCityLink[];
}) {
    return (
        <RestaurantDirectoryContext.Provider value={cities}>
            {children}
        </RestaurantDirectoryContext.Provider>
    );
}

export function useRestaurantDirectory(): readonly RestaurantCityLink[] {
    return useContext(RestaurantDirectoryContext);
}

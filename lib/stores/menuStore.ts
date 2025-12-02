"use client";

import { create } from "zustand";
import type { Restaurant, Menu, Category, Item, ItemsByCategory } from "@/lib/types";

type MenuStore = {
    restaurant: Restaurant | null;
    menu: Menu | null;
    categories: Category[];
    itemsByCategory: ItemsByCategory;

    setMenuData: (data: {
        restaurant: Restaurant;
        menu: Menu;
        categories: Category[];
        itemsByCategory: ItemsByCategory;
    }) => void;

    clearMenu: () => void;
};

export const useMenuStore = create<MenuStore>((set) => ({
    restaurant: null,
    menu: null,
    categories: [],
    itemsByCategory: {},

    setMenuData: ({ restaurant, menu, categories, itemsByCategory }) =>
        set({
            restaurant,
            menu,
            categories,
            itemsByCategory,
        }),

    clearMenu: () =>
        set({
            restaurant: null,
            menu: null,
            categories: [],
            itemsByCategory: {},
        }),
}));

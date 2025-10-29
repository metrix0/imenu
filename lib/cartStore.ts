import { create } from "zustand";

type CartItem = { itemId: string; name: string; price_cents: number; qty: number };
type CartState = {
    items: CartItem[];
    add: (it: Omit<CartItem, "qty">, qty?: number) => void;
    remove: (itemId: string) => void;
    setQty: (itemId: string, qty: number) => void;
    total_cents: () => number;
};

export const useCart = create<CartState>((set, get) => ({
    items: [],
    add: (it, qty = 1) =>
        set(s => {
            const existing = s.items.find(x => x.itemId === it.itemId);
            if (existing) existing.qty += qty;
            else s.items.push({ ...it, qty });
            return { items: [...s.items] };
        }),
    remove: (itemId) => set(s => ({ items: s.items.filter(x => x.itemId !== itemId) })),
    setQty: (itemId, qty) => set(s => ({ items: s.items.map(x => x.itemId === itemId ? { ...x, qty } : x) })),
    total_cents: () => get().items.reduce((sum, x) => sum + x.price_cents * x.qty, 0),
}));

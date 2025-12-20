// lib/types.ts

export type Restaurant = {
    id: string;
    name: string;
    logo_url: string | null;
    banner_url: string | null;
    rating: number | null,
    min_order_cents: number,
    prep_time_min_minutes?: number | null;
    prep_time_max_minutes?: number | null;
    prep_time_source?: "manual" | "auto" | null;
    prep_time_computed_at?: string | null;
    availability_json: any;
    delivery_fee_json: any;
    latitude: number;
    longitude: number;
    is_closed: any;
    url_slug?: string;
};

export type Menu = {
    id: string;
    name: string;
    description: string | null;
    banner_url: string | null;
    restaurant_id: string;
    is_active?: boolean | null;
};

export type Category = {
    id: string;
    name: string;
    position: number;
};

export type Item = {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_path: string | null;
    is_available: boolean;
    position: number;
    category: Category | null;
    image_public_url?: string | null;
};

export type Subcategory = {
    id: string;
    item_id: string;
    name: string;
    description: string | null;
    min_select: number;
    max_select: number;
    position: number;
    subitems: Subitem[];
};

export type Subitem = {
    id: string;
    item_subcategory_id: string;
    name: string;
    description: string | null;
    price_cents: number;
    is_available: boolean;
    position: number;
};



export type ItemsByCategory = {
    [categoryId: string]: Item[];
};

export type CartItem = {
    itemId: string; // ID único para ESTA configuração no carrinho (ex: "uuid" ou "item_id-timestamp")
    name: string; // Nome descritivo (ex: "Açaí (Leite em pó, Morango)")
    price_cents: number; // Preço unitário TOTAL (item + subitens)
    qty: number;

    // Metadados para referência, se necessário
    base_item_id: string; // O ID original do item no DB
    menuId: string; // Para saber para onde voltar
};

export type CartStore = {
    items: CartItem[];
    add: (item: CartItem) => void;
    remove: (itemId: string) => void;
    setQty: (itemId: string, qty: number) => void;
    total_cents: () => number;
    clearCart: () => void;
};

export type AddressData = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number: string;
    complement: string;
    latitude: number | null;
    longitude: number | null;
};

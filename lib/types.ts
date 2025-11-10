// lib/types.ts
// Tipos do Banco de Dados (inferidos do seu admin page)

export type Restaurant = {
    id: string;
    name: string; // Supondo que o nome esteja aqui, ou no menu
    logo_url: string | null;
};

export type Menu = {
    id: string;
    name: string;
    description: string | null;
    banner_url: string | null;
    restaurant_id: string;
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
    // Para facilitar no cliente
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
    // Itens aninhados
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

// Tipos da Aplicação

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
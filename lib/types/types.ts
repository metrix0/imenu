export type PromotionType = "fixed" | "percent";

export interface Promotion {
    id: string;
    item_id: string;
    type: PromotionType;
    value: number;
    starts_at: string;
    ends_at: string;
    active: boolean;
}

export type Restaurant = {
    automatic_promotions?: import("@/lib/promotions/automatic").AutomaticPromotion[];
    id: string;
    name: string;
    logo_url: string | null;
    banner_url: string | null;
    rating: number | null;
    min_order_cents: number;
    prep_time_min_minutes?: number | null;
    prep_time_max_minutes?: number | null;
    prep_time_source?: "manual" | "auto" | null;
    prep_time_computed_at?: string | null;
    availability_json: any;
    delivery_fee_json: any;
    delivery_fee_mode?: "radius" | "neighborhood" | null;
    delivery_neighborhood_fee_json?: unknown;
    latitude: number;
    longitude: number;
    is_closed: any;
    url_slug?: string;
    phone?: string | null;
    store_whatsapp?: string | null;
    allowed_payment_methods?: string[] | null;
    pickup_enabled?: boolean;
    allow_future_order_scheduling?: boolean;
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
    category?: Category | null;
    image_public_url?: string | null;
    promotion?: Promotion;
};

export type Subcategory = {
    id: string;
    item_id: string;
    name: string;
    description: string | null;
    min_select: number;
    max_select: number;
    allow_multiple_units: boolean;
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
    id: string;
    base_item_id: string;
    name: string;
    image: string | null;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    observation?: string;
    is_reward?: boolean;
    automatic_promotion_id?: string;
    selectedSubitems: {
        subcategoryId: string;
        subcategoryName: string;
        subitemId: string;
        subitemName: string;
        price_cents: number;
        quantity?: number;
    }[];
    promotion?: Promotion;
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

export type Order = {
    id: string;
    restaurant_id: string;
    status: string;
    subtotal_cents: number;
    delivery_cents: number;
    total_cents: number;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    payment_ref: string | null;
    created_at: string;
    updated_at: string;
    is_delivery: string;
    display_id: number;
    payment_method: string;
    delivery_eta: string | null;
    coupon_id: string | null;
    coupon_code: string | null;
    coupon_discount_cents: number | null;
    owner_notified: boolean;
    loyalty_credited: boolean;
    loyalty_points_used: number;
};

export type LoyaltyProgram = {
    id: string;
    restaurant_id: string;
    goal_count: number;
    active: boolean;
    min_order_value_cents: number;
    reward_item_id: string | null;
    reward_subitem_ids: string[];
    reward_description: string | null;
    created_at?: string;
    updated_at?: string;
};

export type LoyaltyBalance = {
    id: string;
    restaurant_id: string;
    customer_phone: string;
    current_count: number;
    total_lifetime_count: number;
    last_order_at: string | null;
};

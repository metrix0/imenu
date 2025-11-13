// app/[slug]/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import CartClientPage from "./cart-client";

// (Tipos que o carrinho precisa)
type OrderItem = {
    id: string; // Este é o 'order_item_id'
    name: string;
    price_cents: number;
    quantity: number;
    base_item_id: string;
    image_path: string | null; 
    image_public_url: string | null;
};
type Order = {
    id: string;
    status: string;
    subtotal_cents: number;
    delivery_cents: number;
    total_cents: number;
    restaurant_id: string;
};

// --- HELPER RESTAURADO ---
const createSupabaseServerClient = () => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    }
    throw new Error("Missing Supabase configuration for server.");
};

// --- HELPER RESTAURADO ---
const getPublicUrl = (supabase: any, bucket: string, path: string | null): string | null => {
    if (!path || typeof path !== "string" || path.trim() === "") return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("data:image")) return path;
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
    } catch (err) {
        console.error(`Erro ao gerar URL pública (supabase, bucket=${bucket}):`, err);
    }
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(path).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
};

// --- HELPER RESTAURADO ---
const getRestaurantLogoUrl = (supabase: any, logoPath: string | null): string | null => {
    const BUCKET = "restaurant-logos";
    if (!logoPath) return null;
    if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) return logoPath;
    if (logoPath.startsWith("data:image")) return logoPath;
    try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(logoPath);
        if (data?.publicUrl) return data.publicUrl;
    } catch (err) {
        console.error("Erro ao gerar URL pública da logo (supabase):", err);
    }
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(logoPath).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${BUCKET}/${encoded}`;
};

type Props = {
    params: { slug: string; id: string };
};

export default async function CartPage({ params }: Props) {
    const { slug, id: orderId } = await params;
    const supabase = createSupabaseServerClient();

    // 1. Buscar o Pedido (Order)
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, status, subtotal_cents, delivery_cents, total_cents, restaurant_id")
        .eq("id", orderId)
        .eq("status", "pending_payment") 
        .single<Order>();
    if (orderError || !order) notFound();

    // 2. Buscar o Restaurante
    const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id, name, logo_url")
        .eq("id", order.restaurant_id)
        .single();
    if (!restaurantData) notFound();

    // --- CORREÇÃO AQUI: Usamos o helper para a logo ---
    const restaurant = {
        ...restaurantData,
        logo_url: getRestaurantLogoUrl(supabase, restaurantData.logo_url)
    };
    // --- FIM DA CORREÇÃO ---

    // 3. Buscar os Itens do Pedido
    const { data: itemsRaw, error: itemsError } = await supabase
        .from("order_items")
        .select("id, name, price_cents, quantity, item_id")
        .eq("order_id", orderId);
    if (itemsError) throw new Error("Erro ao buscar itens do pedido.");
    
    // (Lógica de busca de imagens na 'item_media')
    const itemBaseIds = (itemsRaw || []).map(it => it.item_id);
    const { data: itemMedia } = await supabase
        .from("item_media")
        .select("item_id, url")
        .in("item_id", itemBaseIds)
        .eq("media_type", "image");
    
    const imageMap = new Map<string, string>();
    if (itemMedia) {
        for (const media of itemMedia) {
            if (!imageMap.has(media.item_id)) {
                imageMap.set(media.item_id, media.url);
            }
        }
    }

    // --- CORREÇÃO AQUI (A mesma da outra vez, para o bug do TS) ---
    const items: OrderItem[] = (itemsRaw || []).map(it => {
        const imagePath = imageMap.get(it.item_id) || null; // 'imagePath' é a 'url' (nome do arquivo)
        
        return {
            id: it.id,
            name: it.name,
            price_cents: it.price_cents,
            quantity: it.quantity,
            base_item_id: it.item_id,
            image_path: imagePath,
            // Agora usamos o helper para construir a URL completa
            image_public_url: getPublicUrl(supabase, "menu-images", imagePath), 
        };
    });
    // --- FIM DA CORREÇÃO ---

    // 4. Buscar "Peça também" (Destaques)
    const { data: highlightedItemsRaw } = await supabase
        .from("items")
        .select("id, name, price_cents")
        .eq("restaurant_id", restaurant.id)
        .eq("is_available", true)
        .eq("is_highlighted", true)
        .limit(5);

    // (Busca de imagens dos destaques)
    const highlightItemIds = (highlightedItemsRaw || []).map(it => it.id);
    const { data: highlightMedia } = await supabase
        .from("item_media")
        .select("item_id, url")
        .in("item_id", highlightItemIds)
        .eq("media_type", "image");
    
    const highlightImageMap = new Map<string, string>();
    if (highlightMedia) {
        for (const media of highlightMedia) {
            if (!highlightImageMap.has(media.item_id)) {
                highlightImageMap.set(media.item_id, media.url);
            }
        }
    }

    // --- CORREÇÃO AQUI (converte 'undefined' para 'null' E usa o helper) ---
    const highlights = (highlightedItemsRaw || []).map((it: any) => {
        const imagePath = highlightImageMap.get(it.id) ?? null;
        return {
            ...it,
            image_public_url: getPublicUrl(supabase, "menu-images", imagePath),
        };
    });
    // --- FIM DA CORREÇÃO ---

    return (
        <CartClientPage
            slug={slug}
            order={order}
            restaurant={restaurant}
            initialItems={items}
            highlights={highlights}
        />
    );
}
// app/[slug]/[id]/checkout/page.tsx
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import CheckoutClientPage from "./checkout-client"; // O componente de UI

// (Tipos que o checkout precisa)
type Order = {
    id: string;
    status: string;
    subtotal_cents: number;
    delivery_cents: number;
    total_cents: number;
    restaurant_id: string;
    // Dados do cliente (salvos na etapa .../info)
    customer_name: string;
    customer_phone: string;
    customer_address: string | null;
    is_delivery: boolean;
};
type Restaurant = {
    id: string;
    name: string;
    logo_url: string | null;
};

// (Helpers - createSupabaseServerClient, getRestaurantLogoUrl)
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
const getRestaurantLogoUrl = (supabase: any, logoPath: string | null): string | null => {
    const BUCKET = "restaurant-logos";
    if (!logoPath) return null;
    if (logoPath.startsWith("http") || logoPath.startsWith("data:image")) return logoPath;
    try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(logoPath);
        if (data?.publicUrl) return data.publicUrl;
    } catch (err) {}
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(logoPath).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${BUCKET}/${encoded}`;
};
// --- FIM DOS HELPERS ---

type Props = {
    params: { slug: string; id: string }; // (nome-do-restaurante) e (id-do-pedido)
};

export default async function CheckoutPage({ params }: Props) {
    // A sua versão tinha 'await params', mas 'params' não é uma Promise aqui
    // se o componente pai não for 'async'. Vamos usar o 'params' direto.
    const { slug, id: orderId } = await params;
    const supabase = createSupabaseServerClient();

    // 1. Buscar o Pedido (Order)
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(
            "id, status, subtotal_cents, delivery_cents, total_cents, restaurant_id, " +
            "customer_name, customer_phone, customer_address, is_delivery"
        )
        .eq("id", orderId)
        // --- CORREÇÃO AQUI ---
        // Alterado de "draft" para "pending_payment"
        .eq("status", "pending_payment")
        // --- FIM DA CORREÇÃO ---
        .single<Order>();

    if (orderError || !order) {
        console.error(`Erro ao buscar pedido ${orderId} ou não é rascunho.`, orderError);
        notFound();
    }

    // 2. Buscar o Restaurante
    const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id, name, logo_url")
        .eq("id", order.restaurant_id)
        .single();

    if (!restaurantData) notFound();

    const restaurant = {
        ...restaurantData,
        logo_url: getRestaurantLogoUrl(supabase, restaurantData.logo_url)
    };

    // 3. Passa os dados para o Componente Cliente
    return (
        <CheckoutClientPage
            slug={slug}
            order={order}
            restaurant={restaurant}
        />
    );
}
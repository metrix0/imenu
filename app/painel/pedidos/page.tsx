// app/menu/[id]/panel/page.tsx
import { createClient } from '@supabase/supabase-js';
import PanelClient from './panel-client';

type Props = {
    params: Promise<{ restauranteId: string }>;
};

// cria cliente server-side tentando usar SERVICE ROLE (mais permissões, evita problemas com RLS)
const createSupabaseServerClient = () => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }
    // fallback para anon (pode falhar se houver RLS)
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
};

export default async function PanelPage({ params }: Props) {
    const { restauranteId } = await params;
    const supabase = createSupabaseServerClient();

    // buscar restaurante para exibir nome do painel (não crítico)
    const { data: restaurant, error: restErr } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("id", restauranteId)
        .maybeSingle();

    if (restErr) {
        console.error("Erro ao buscar restaurante:", restErr);
        // continua exibindo painel mesmo sem nome do restaurante
    }

    // Buscar pedidos do restaurante (mais robusto: select * e ordenação)
    const { data: ordersRaw, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restauranteId)
        .order("created_at", { ascending: false });

    if (ordersErr) {
        console.error("Erro ao buscar pedidos:", ordersErr);
        return <div>Erro ao buscar pedidos</div>;
    }
    const orders = ordersRaw ?? [];

    // Buscar order_items relacionados (se houver pedidos)
    const orderIds = orders.map((o: any) => o.id);
    const { data: orderItemsRaw, error: orderItemsErr } = orderIds.length > 0
        ? await supabase.from("order_items").select("*").in("order_id", orderIds)
        : { data: [], error: null };

    if (orderItemsErr) {
        console.error("Erro ao buscar order_items:", orderItemsErr);
    }
    const orderItems = orderItemsRaw ?? [];

    // Buscar order_item_subitems relacionados (se houver order_items)
    const orderItemIds = orderItems.map((oi: any) => oi.id);
    const { data: oisData, error: oisErr } = orderItemIds.length > 0
        ? await supabase.from("order_item_subitems").select("*").in("order_item_id", orderItemIds)
        : { data: [], error: null };

    if (oisErr) {
        console.error("Erro ao buscar order_item_subitems:", oisErr);
    }
    const orderItemSubitems = oisData ?? [];

    return (
        <PanelClient
            menuName={restaurant?.name ?? "Painel"}
            orders={orders}
            orderItems={orderItems}
            orderItemSubitems={orderItemSubitems}
        />
    );
}

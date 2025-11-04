// app/menu/[id]/panel/page.tsx
import { createClient } from '@supabase/supabase-js';
import PanelClient from './panel-client';

type Props = {
    params: Promise<{ id: string }>;
};

export default async function PanelPage({ params }: Props) {
    const { id: menuId } = await params;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Buscar menu e restaurante do menu
    const { data: menu, error: menuError } = await supabase
        .from('menu')
        .select('id, restaurant_id, name')
        .eq('id', menuId)
        .single();

    if (menuError || !menu) return <div>Menu não encontrado</div>;

    // Buscar pedidos do restaurante deste menu
    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select(
            `id, 
            customer_name, 
            customer_address,
            delivery_cents,
            status, 
            created_at, 
            total_cents`
        )
        .eq('restaurant_id', menu.restaurant_id)
        .order('created_at', { ascending: false });

    if (ordersErr) {
        console.error(ordersErr);
        return <div>Erro ao buscar pedidos</div>;
    }

    // Se não houver pedidos, passar array vazio para o client
    if (!orders || orders.length === 0) {
        return <PanelClient menuName={menu.name} orders={[]} orderItems={[]} orderItemSubitems={[]} />;
    }

    // Buscar todos os order_items referentes a esses pedidos
    const orderIds = orders.map((o: any) => o.id);

    const { data: orderItems, error: orderItemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

    if (orderItemsErr) {
        console.error(orderItemsErr);
        return <PanelClient menuName={menu.name} orders={orders} orderItems={[]} orderItemSubitems={[]} />;
    }

    // --- NOVO: buscar order_item_subitems para os order_items recuperados ---
    const orderItemIds = (orderItems || []).map((oi: any) => oi.id);
    let orderItemSubitems: any[] = [];
    if (orderItemIds.length > 0) {
        const { data: oisData, error: oisErr } = await supabase
            .from('order_item_subitems')
            .select('*')
            .in('order_item_id', orderItemIds);
        if (oisErr) {
            console.error('Erro ao buscar subitens de pedidos:', oisErr);
            orderItemSubitems = [];
        } else {
            orderItemSubitems = oisData ?? [];
        }
    }

    return (
        <PanelClient
            menuName={menu.name}
            orders={orders}
            orderItems={orderItems || []}
            orderItemSubitems={orderItemSubitems}
        />
    );
}

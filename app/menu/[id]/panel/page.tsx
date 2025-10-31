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
    const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_name, status, created_at, total_cents')
        .eq('restaurant_id', menu.restaurant_id)
        .order('created_at', { ascending: false });

    if (!orders) return <div>Nenhum pedido encontrado.</div>;

    // Buscar os itens pertencentes ao menu
    const { data: menuItems } = await supabase
        .from('menu_items')
        .select('item_id')
        .eq('menu_id', menuId);

    const menuItemIds = menuItems?.map(m => m.item_id) ?? [];

    // Buscar itens dos pedidos desse menu
    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .in('item_id', menuItemIds);

    return (
        <PanelClient
            menuName={menu.name}
            orders={orders}
            orderItems={orderItems}
        />
    );
}

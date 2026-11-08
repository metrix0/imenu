import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { dispatchCourier } from "@/lib/delivery/integrations";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const { rows: [order] } = await query("SELECT restaurant_id FROM orders WHERE id=$1",[id]);
        if (!order) return NextResponse.json({error:"Pedido não encontrado."},{status:404});
        await requireRestaurantOwner(request,order.restaurant_id);
        const { rows: [dispatch] } = await query("SELECT state FROM delivery_dispatches WHERE order_id=$1",[id]);
        if (dispatch?.state !== "failed") return NextResponse.json({error:"Confira a solicitação na Machine antes de tentar novamente."},{status:409});
        const error = await dispatchCourier(id);
        if (error) return NextResponse.json({error},{status:502});
        const { rows: [result] } = await query("SELECT state FROM delivery_dispatches WHERE order_id=$1",[id]);
        if (result?.state !== "requested") return NextResponse.json({error:"Entregador não solicitado. Verifique se a integração está ativa e o pedido está em preparação."},{status:409});
        return NextResponse.json({ok:true});
    } catch (error) {
        return NextResponse.json({error:error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível solicitar o entregador."},
            {status:error instanceof RestaurantOwnerAuthError ? error.status : 503});
    }
}

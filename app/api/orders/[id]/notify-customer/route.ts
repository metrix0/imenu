import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { getOrderNotificationContext, sendOrderNotification, OrderNotificationError } from "@/lib/services/whatsappNotification";

async function authorize(request: Request, id: string) {
    const {rows:[order]} = await query<{restaurant_id:string}>("SELECT restaurant_id FROM orders WHERE id=$1",[id]);
    if (!order) throw new OrderNotificationError("Pedido não encontrado.",404);
    await requireRestaurantOwner(request,order.restaurant_id);
}
function failure(error: unknown) {
    if (error instanceof OrderNotificationError || error instanceof RestaurantOwnerAuthError)
        return NextResponse.json({error:error.message},{status:error.status});
    console.error("[NOTIFY_CUSTOMER]",error);
    return NextResponse.json({error:"Não foi possível notificar o cliente."},{status:500});
}
export async function GET(request: Request, context: {params:Promise<{id:string}>}) {
    try {
        const {id}=await context.params; await authorize(request,id);
        const order=await getOrderNotificationContext(id);
        return NextResponse.json({plus:order.plus,recent:order.recent,status:order.arrivalStatus});
    } catch(error) {return failure(error);}
}
export async function POST(request: Request, context: {params:Promise<{id:string}>}) {
    try {
        const {id}=await context.params; await authorize(request,id);
        const body=await request.json();
        return NextResponse.json(await sendOrderNotification(id,"arrival",body.confirmed===true));
    } catch(error) {return failure(error);}
}

import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
        .from("orders")
        .select(`
      restaurant_id,
      restaurants!inner (
        id,
        name,
        phone,
        payment_info
      )
    `)
        .in("payment_method", ["pix", "cartao"])
        .neq("status", "pending_online_payment")
        .neq("status", "canceled");

    if (error) {
        return Response.json({ error }, { status: 500 });
    }

    // Deduplicate restaurants
    const uniqueRestaurants = Object.values(
        data.reduce((acc: any, row: any) => {
            acc[row.restaurant_id] = row.restaurants;
            return acc;
        }, {})
    );

    return Response.json(uniqueRestaurants);
}
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: Request) {
    console.log("ROUTE CALLED");

    try {
        // ---------------------------
        // 1. Parse body
        // ---------------------------
        const body = await request.json();
        const { restaurantId, rules, minOrder } = body;

        console.log("BODY RECEIVED:", body);

        if (!restaurantId || !rules || minOrder == null) {
            return NextResponse.json(
                { message: "Missing parameters" },
                { status: 400 }
            );
        }

        // ---------------------------
        // 2. Read auth token
        // ---------------------------
        const token = request.headers
            .get("Authorization")
            ?.replace("Bearer ", "");

        if (!token) {
            console.log("❌ Missing auth token");
            return NextResponse.json(
                { message: "Not authenticated" },
                { status: 401 }
            );
        }

        // ---------------------------
        // 3. Create Supabase server client
        // ---------------------------
        const supabaseServer = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            }
        );

        console.log("Updating restaurant:", restaurantId);

        // ---------------------------
        // 4. Update DB (with guaranteed commit)
        // ---------------------------
        const { data, error } = await supabaseServer
            .from("restaurants")
            .update({
                delivery_fee_json: rules,
                min_order_cents: minOrder * 100,
            })
            .eq("id", restaurantId)
            .select(); // Forces DB commit + return updated row

        console.log("SUPABASE RESPONSE:");
        console.log("data:", data);
        console.log("error:", error);

        if (error) {
            return NextResponse.json(
                { message: error.message },
                { status: 500 }
            );
        }

        if (!data || data.length === 0) {
            return NextResponse.json(
                { message: "Restaurant not found or not allowed" },
                { status: 404 }
            );
        }

        // ---------------------------
        // 5. Return OK
        // ---------------------------
        return NextResponse.json({ ok: true, data });
    } catch (err: any) {
        console.error("❌ FATAL ERROR IN UPDATE-RESTAURANT:", err);
        return NextResponse.json(
            { message: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}

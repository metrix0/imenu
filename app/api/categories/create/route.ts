import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { restaurant_id, name, position = 0 } = body;

        if (!restaurant_id || !name) {
            return NextResponse.json(
                { error: "restaurant_id and name are required" },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
            .from("categories")
            .insert({
                restaurant_id,
                name,
                position,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ category: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json(
            { error: "Failed to create category", details: err.message },
            { status: 500 }
        );
    }
}

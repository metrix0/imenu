import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            restaurant_id,
            category_id,
            name,
            description,
            price_cents,
            image_path,
            is_available = true,
            position = 0,
        } = body;

        if (!restaurant_id || !category_id || !name || price_cents == null) {
            return NextResponse.json(
                { error: "restaurant_id, category_id, name and price_cents are required" },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
            .from("items")
            .insert({
                restaurant_id,
                category_id,
                name,
                description,
                price_cents,
                image_path,
                is_available,
                position,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ item: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json(
            { error: "Failed to create item", details: err.message },
            { status: 500 }
        );
    }
}

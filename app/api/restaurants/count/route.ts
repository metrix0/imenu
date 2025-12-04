import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function GET() {
    try {
        const supabase = createSupabaseServerClient();

        const { count, error } = await supabase
            .from("restaurants")
            .select("*", { count: "exact", head: true });

        if (error) {
            console.error("[COUNT ERROR]", error);
            return NextResponse.json({ error: "Failed to count restaurants" }, { status: 500 });
        }

        return NextResponse.json({ count });
    } catch (err) {
        console.error("[SERVER ERROR]", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

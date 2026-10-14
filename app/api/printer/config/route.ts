import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    let publicKey = key?.startsWith("sb_publishable_") || false;
    try {
        if (key?.split(".").length === 3) {
            const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
            publicKey = payload.role === "anon";
        }
        if (!url || !key || !publicKey || !["http:", "https:"].includes(new URL(url).protocol)) {
            return NextResponse.json({ error: "Printer connection unavailable" }, { status: 503 });
        }
    } catch {
        return NextResponse.json({ error: "Printer connection unavailable" }, { status: 503 });
    }
    return NextResponse.json(
        { supabaseUrl: url.replace(/\/+$/, ""), supabaseAnonKey: key },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
}

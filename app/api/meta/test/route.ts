import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export async function POST(req: NextRequest) {
    try {
        const { slug, event_name = "Purchase", test_event_code } =
            await req.json();

        if (!slug) {
            return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
        }

        const supabase = createSupabaseServerClient();

        const { data } = await supabase
            .from("restaurants")
            .select("tracking_integrations (meta_pixel_id, meta_capi_token)")
            .eq("url_slug", slug)
            .maybeSingle();

        const tracking = data?.tracking_integrations?.[0];

        if (!tracking?.meta_pixel_id || !tracking?.meta_capi_token) {
            return NextResponse.json({ ok: false, error: "Pixel or token missing" });
        }

        const event_source_url =
            req.headers.get("referer") ??
            `http://localhost:3000/${slug}`;

        const payload: any = {
            data: [
                {
                    event_name,
                    event_time: Math.floor(Date.now() / 1000),
                    event_id: "meta-test-" + Date.now(),
                    action_source: "website",
                    event_source_url: `http://localhost:3000/${slug}`,
                    user_data: {
                        client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
                        client_user_agent: req.headers.get("user-agent") ?? undefined,
                    },
                    custom_data: { value: 10.5, currency: "BRL" },
                },
            ],
        };

        if (test_event_code) payload.test_event_code = test_event_code;
        const resp = await fetch(
            `https://graph.facebook.com/v20.0/${tracking.meta_pixel_id}/events?access_token=${tracking.meta_capi_token}`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            }
        );

        const metaJson = await resp.json().catch(() => ({}));

        return NextResponse.json(
            { ok: resp.ok, status: resp.status, meta: metaJson },
            { status: resp.ok ? 200 : resp.status }
        );
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message ?? "Unknown error" },
            { status: 500 }
        );
    }
}
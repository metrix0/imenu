import { NextResponse } from "next/server";
import { isMetaFunnelEvent, metaCommerceData } from "@/lib/analytics/metaEvents";
import { metaContext, metaDestination, sendMetaEvent } from "@/lib/analytics/metaServer";
import { validCheckoutOrigin } from "@/lib/services/checkoutCustomer";

export async function POST(request: Request) {
    if (!validCheckoutOrigin(request)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false }, { status: 400 });

    try {
        const { slug, event_name, event_id, custom_data, customer, test_event_code } = body;
        if (
            typeof slug !== "string" || !slug || slug.length > 200 ||
            !isMetaFunnelEvent(event_name) ||
            typeof event_id !== "string" || !/^[\w-]{1,80}$/.test(event_id)
        ) return NextResponse.json({ ok: false }, { status: 400 });

        const destination = await metaDestination({ slug });
        if (!destination?.token) return NextResponse.json({ ok: true, skipped: true });

        const products: { id: string; quantity: number }[] = [];
        const contents = Array.isArray(custom_data?.contents) ? custom_data.contents
            : Array.isArray(custom_data?.content_ids)
                ? custom_data.content_ids.map((id: unknown) => ({ id, quantity: 1 }))
                : [];
        for (const item of contents.slice(0, 100)) {
            if (
                item && typeof item.id === "string" && /^[\w-]{1,64}$/.test(item.id) &&
                Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10_000
            ) products.push({ id: item.id, quantity: item.quantity });
        }
        const value = Math.round(Number(custom_data?.value) * 100);
        const data = metaCommerceData(products, Number.isSafeInteger(value) && value >= 0 ? value : 0);
        const context = metaContext(request, slug, destination.restaurantId, customer ?? {});
        const testEventCode = typeof test_event_code === "string" && /^[\w-]{1,80}$/.test(test_event_code)
            ? test_event_code
            : undefined;
        await sendMetaEvent(destination, event_name, event_id, data, context, undefined, testEventCode);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.warn("[META] Funnel event failed", error instanceof Error ? error.message : "");
        return NextResponse.json({ ok: false }, { status: 502 });
    }
}

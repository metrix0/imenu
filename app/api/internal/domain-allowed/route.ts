import { query } from "@/lib/database/sql";
import { usesVpsDomains } from "@/lib/services/vpsDomains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!usesVpsDomains()) return new Response(null, { status: 404 });
    const domain = (new URL(request.url).searchParams.get("domain") || "").trim().toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) || domain.length > 253) {
        return new Response(null, { status: 403 });
    }
    const platformDomains = (process.env.IMENU_TLS_DOMAINS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
    if (platformDomains.includes(domain)) return new Response(null, { status: 200 });
    try {
        const result = await query(
            "SELECT 1 FROM public.restaurants WHERE LOWER(custom_domain) = $1 LIMIT 1", [domain]
        );
        return new Response(null, { status: result.rows.length ? 200 : 403 });
    } catch {
        return new Response(null, { status: 503 });
    }
}

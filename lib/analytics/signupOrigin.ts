import { normalizeAffiliateCode } from "./affiliateCode";

type SignupOrigin = {
    path: string;
    source: string | null;
    referrer: string | null;
    affiliate: string | null;
};

const PUBLIC_PAGES = new Set([
    "/", "/cardapio-digital", "/cardapio-digital-gratuito", "/gestor-de-pedidos",
    "/anota-ai", "/cardapio-web", "/consumer", "/delivery-direto", "/goomer", "/grandchef",
    "/neemo", "/olaclick", "/saipos", "/simpliza", "/wabiz", "/restaurante/registrar", "/restaurante/login",
]);

function originCookie(host: string) {
    return host === "preview.imenuapp.com.br" ? "imenu_preview_signup_origin" : "imenu_signup_origin";
}

function publicPath(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 160) return null;
    return PUBLIC_PAGES.has(value) || /^\/(blog|ferramentas|restaurantes)(\/[a-z0-9-]+)?$/.test(value)
        ? value : null;
}

function clean(value: unknown, pattern: RegExp): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return pattern.test(normalized) ? normalized : null;
}

function sanitizeOrigin(value: unknown): SignupOrigin | null {
    if (!value || typeof value !== "object") return null;
    const origin = value as Record<string, unknown>;
    const path = publicPath(origin.path);
    if (!path) return null;
    return {
        path,
        source: clean(origin.source, /^[a-z0-9][a-z0-9 ._-]{0,79}$/),
        referrer: clean(origin.referrer, /^(?=.{1,120}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
        affiliate: typeof origin.affiliate === "string" ? normalizeAffiliateCode(origin.affiliate) : null,
    };
}

export function readSignupOrigin(request: Request, host: string): SignupOrigin | null {
    const prefix = `${originCookie(host)}=`;
    const cookie = request.headers.get("cookie")?.split(/;\s*/).find(part => part.startsWith(prefix));
    if (!cookie || cookie.length > 1200) return null;
    try {
        return sanitizeOrigin(JSON.parse(Buffer.from(cookie.slice(prefix.length), "base64url").toString("utf8")));
    } catch {
        return null;
    }
}

export function getSignupOriginCookie(request: Request, url: URL, host: string, affiliate: string | null) {
    if (request.method !== "GET" || !request.headers.get("accept")?.includes("text/html") ||
        request.headers.has("next-router-prefetch") || request.headers.get("sec-purpose")?.includes("prefetch") ||
        request.headers.get("purpose") === "prefetch" || request.headers.get("sec-fetch-dest") === "iframe" ||
        !publicPath(url.pathname) || readSignupOrigin(request, host)) return null;

    let referrer: string | null = null;
    try {
        const ref = new URL(request.headers.get("referer") || "");
        if (["http:", "https:"].includes(ref.protocol) && ref.hostname !== host &&
            ref.hostname !== "imenuapp.com.br" && !ref.hostname.endsWith(".imenuapp.com.br")) {
            referrer = ref.hostname;
        }
    } catch {
        // Direct visits may arrive without a Referer header.
    }

    const origin = sanitizeOrigin({ path: url.pathname, source: url.searchParams.get("utm_source"), referrer, affiliate });
    const production = host === "imenuapp.com.br" || host === "www.imenuapp.com.br";
    return {
        name: originCookie(host),
        value: Buffer.from(JSON.stringify(origin)).toString("base64url"),
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: production || host === "preview.imenuapp.com.br",
        domain: production ? "imenuapp.com.br" : undefined,
        maxAge: 365 * 24 * 60 * 60,
    };
}

export function formatSignupOrigin(value: unknown): string | null {
    const origin = sanitizeOrigin(value);
    if (!origin) return null;
    if (origin.affiliate) return `Afiliado · af=${origin.affiliate}`;
    if (origin.source) {
        const source = origin.source.charAt(0).toUpperCase() + origin.source.slice(1);
        return `${source} · ${origin.path === "/" ? `utm_source=${origin.source}` : origin.path}`;
    }
    if (origin.referrer) {
        const source = /^(?:www\.)?google\.(?:com(?:\.br)?|[a-z]{2})$/.test(origin.referrer)
            ? "Google" : origin.referrer.replace(/^www\./, "");
        return `${source} · ${origin.path}`;
    }
    return origin.path === "/" ? "Direto" : `Direto · ${origin.path}`;
}

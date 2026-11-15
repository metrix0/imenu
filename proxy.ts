import { NextResponse, type NextFetchEvent } from "next/server";
import { randomUUID } from "node:crypto";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_MAX_AGE, normalizeAffiliateCode, readAffiliateCookie } from "@/lib/analytics/affiliateCode";
import { captureAffiliateEvent } from "@/lib/analytics/affiliateAttribution";
import { getSignupOriginCookie } from "@/lib/analytics/signupOrigin";
import { query } from "@/lib/database/sql";

const NON_GOOGLE_INDEXING_CRAWLER =
  /(bytespider|adidxbot|bingpreview|duckduckbot|baiduspider|yandexbot|yandeximages|applebot|petalbot|seznambot|sogou|exabot|qwantify|ahrefsbot|semrushbot|mj12bot|dotbot|serpstatbot|ccbot|gptbot|claudebot|anthropic-ai|perplexitybot|cohere-ai|amazonbot|omgilibot|diffbot|imagesiftbot)/i;

export async function proxy(req: Request, event: NextFetchEvent) {
  const url = new URL(req.url);
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const pathname = url.pathname;
  const userAgent = req.headers.get("user-agent") ?? "";
  const isPreviewDomain = host === "preview.imenuapp.com.br";

  if (
    pathname !== "/robots.txt" &&
    NON_GOOGLE_INDEXING_CRAWLER.test(userAgent) &&
    !/google/i.test(userAgent)
  ) {
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const code = normalizeAffiliateCode(url.searchParams.get("af"));
  const isAffiliateHost = [ "imenuapp.com.br", "www.imenuapp.com.br", "preview.imenuapp.com.br", "localhost", "127.0.0.1" ].includes(host);
  if (req.method === "GET" && code && isAffiliateHost && !readAffiliateCookie(req)) {
    try {
      const { rows } = await query("SELECT 1 FROM public.affiliate_partners WHERE code = $1", [code]);
      if (rows.length) {
        const visitId = randomUUID();
        const response = NextResponse.next();
        response.cookies.set(AFFILIATE_COOKIE, `${code}.${visitId}`, {
          httpOnly: true, sameSite: "lax", secure: !["localhost", "127.0.0.1"].includes(host),
          path: "/", maxAge: AFFILIATE_COOKIE_MAX_AGE,
        });
        const origin = getSignupOriginCookie(req, url, host, code);
        if (origin) response.cookies.set(origin);
        response.headers.set("Cache-Control", "private, no-store");
        if (isPreviewDomain) response.headers.set("X-Robots-Tag", "noindex, nofollow");
        event.waitUntil(captureAffiliateEvent("affiliate_link_visited", visitId, visitId, { af: code, referral_visit_id: visitId }));
        return response;
      }
    } catch (error) {
      console.warn("[AFFILIATE] Could not resolve code:", error instanceof Error ? error.name : "unknown");
    }
  }

  const origin = isAffiliateHost ? getSignupOriginCookie(req, url, host, null) : null;
  if (isPreviewDomain || origin) {
    const response = NextResponse.next();
    if (isPreviewDomain) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (origin) {
      response.cookies.set(origin);
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  }

  const isDominos =
    host === "dominoslimeira.com.br" ||
    host === "www.dominoslimeira.com.br";

  // 🔁 Redirect problematic dynamic routes
  if (isDominos && pathname.startsWith("/pedido/")) {
    return Response.redirect(
      `https://www.imenuapp.com.br${pathname}`,
      302
    );
  }

  // ✅ Safe rewrite only for root
  if (isDominos && pathname === "/") {
    url.pathname = "/dominos-limeira";
    return new Response(null, {
      status: 200,
      headers: {
        "x-middleware-rewrite": url.toString(),
      },
    });
  }

  const isPlatformDomain =
    host === "imenuapp.com.br" ||
    host === "www.imenuapp.com.br" ||
    host.endsWith(".imenuapp.com.br") ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (pathname === "/" && host && !isPlatformDomain) {
    try {
      const { rows } = await query<{ url_slug: string | null }>(
        `
        SELECT url_slug
        FROM public.restaurants
        WHERE LOWER(custom_domain) = LOWER($1)
        LIMIT 1
        `,
        [host]
      );
      const slug = rows[0]?.url_slug;

      if (slug) {
        url.pathname = `/${slug}`;
        return new Response(null, {
          status: 200,
          headers: {
            "x-middleware-rewrite": url.toString(),
          },
        });
      }
    } catch (error) {
      console.error("Error resolving custom domain:", error);
    }
  }

  return;
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};

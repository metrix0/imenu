import { query } from "@/lib/database/sql";

const NON_GOOGLE_INDEXING_CRAWLER =
  /(bytespider|bingbot|adidxbot|bingpreview|duckduckbot|baiduspider|yandexbot|yandeximages|applebot|petalbot|seznambot|sogou|exabot|qwantify|ahrefsbot|semrushbot|mj12bot|dotbot|serpstatbot|ccbot|gptbot|claudebot|anthropic-ai|perplexitybot|cohere-ai|amazonbot|omgilibot|diffbot|imagesiftbot)/i;

export async function proxy(req: Request) {
  const url = new URL(req.url);
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const pathname = url.pathname;
  const userAgent = req.headers.get("user-agent") ?? "";

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

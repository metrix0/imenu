import { query } from "@/lib/database/sql";

export async function proxy(req: Request) {
  const url = new URL(req.url);
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const pathname = url.pathname;

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

// The existing proxy has behavior only for these two path groups.
export const config = {
  matcher: ["/", "/pedido/:path*"],
};

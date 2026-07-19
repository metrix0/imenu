export function proxy(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? "";
  const pathname = url.pathname;

  const isDominos =
    host === "dominoslimeira.com.br" ||
    host === "www.dominoslimeira.com.br";

  if (!isDominos) return;

  // 🔁 Redirect problematic dynamic routes
  if (pathname.startsWith("/pedido/")) {
    return Response.redirect(
      `https://www.imenuapp.com.br${pathname}`,
      302
    );
  }

  // ✅ Safe rewrite only for root
  if (pathname === "/") {
    url.pathname = "/dominos-limeira";
    return new Response(null, {
      status: 200,
      headers: {
        "x-middleware-rewrite": url.toString(),
      },
    });
  }

  return;
}

// The existing proxy has behavior only for these two path groups.
export const config = {
  matcher: ["/", "/pedido/:path*"],
};

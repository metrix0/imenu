import * as Sentry from "@sentry/nextjs";

export function proxy(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? "";

  Sentry.setTag("host", host);
  Sentry.setTag("path", url.pathname);

  const isDominos =
    host === "dominoslimeira.com.br" ||
    host === "www.dominoslimeira.com.br";

  if (isDominos) {
    // Rewrite root
    if (url.pathname === "/") {
      url.pathname = "/dominos-limeira";
    }
    // Rewrite all other paths
    else if (!url.pathname.startsWith("/dominos-limeira")) {
      url.pathname = `/dominos-limeira${url.pathname}`;
    }

    return new Response(null, {
      status: 200, // ✅ CRITICAL FIX
      headers: {
        "x-middleware-rewrite": url.toString(),
      },
    });
  }

  // Let everything else pass
  return;
}

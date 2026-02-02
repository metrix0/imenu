import * as Sentry from "@sentry/nextjs";

export function proxy(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? "";
  const pathname = url.pathname;

  Sentry.setTag("host", host);
  Sentry.setTag("path", pathname);

  const isDominos =
    host === "dominoslimeira.com.br" ||
    host === "www.dominoslimeira.com.br";

  // 🚫 NEVER rewrite assets
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname); // any file extension

  if (isDominos && !isAsset) {
    // Rewrite root
    if (pathname === "/") {
      url.pathname = "/dominos-limeira";
    }
    // Rewrite all other routes
    else if (!pathname.startsWith("/dominos-limeira")) {
      url.pathname = `/dominos-limeira${pathname}`;
    }

    return new Response(null, {
      status: 200,
      headers: {
        "x-middleware-rewrite": url.toString(),
      },
    });
  }

  // Let assets & other domains pass untouched
  return;
}

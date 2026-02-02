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

  // 🚫 NEVER rewrite non-page requests
  const isInternal =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_rsc") ||
    pathname.startsWith("/_actions");

  const isAsset =
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webmanifest)$/.test(
      pathname
    );

  if (!isDominos || isInternal || isAsset) {
    return;
  }

  // Rewrite root
  if (pathname === "/") {
    url.pathname = "/dominos-limeira";
  }
  // Rewrite page routes only
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

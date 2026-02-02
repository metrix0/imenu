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
    // Se acessar /, vira /dominos-limeira
    if (url.pathname === "/") {
      url.pathname = "/dominos-limeira";
    }
    // Se acessar qualquer outra rota (/menu, /pedido, etc)
    else if (!url.pathname.startsWith("/dominos-limeira")) {
      url.pathname = `/dominos-limeira${url.pathname}`;
    }

    return new Response(null, {
      status: 307,
      headers: {
        "x-middleware-rewrite": url.toString(),
      },
    });
  }

  return;
}

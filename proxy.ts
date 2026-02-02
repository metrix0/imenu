import * as Sentry from "@sentry/nextjs";

export function proxy(req: Request) {
    const url = new URL(req.url);
    const host = req.headers.get("host") ?? "";

    // Mantém o tracking atual
    Sentry.setTag("path", url.pathname);
    Sentry.setTag("host", host);

    const isDominos =
        host === "dominoslimeira.com.br" ||
        host === "www.dominoslimeira.com.br";

    // Rewrite interno: / → /dominos-limeira
    if (isDominos && url.pathname === "/") {
        url.pathname = "/dominos-limeira";
        return new Response(null, {
            status: 307,
            headers: {
                "x-middleware-rewrite": url.toString(),
            },
        });
    }

    // Segue fluxo normal
    return;
}

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const host = req.headers.get("host") ?? "";
    const url = req.nextUrl;

    const isDominos =
        host === "dominoslimeira.com.br" ||
        host === "www.dominoslimeira.com.br";

    // Se acessar a raiz do domínio do Dominos
    if (isDominos && url.pathname === "/") {
        url.pathname = "/dominos-limeira";
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Aplica em tudo, exceto:
         * - arquivos estáticos
         * - _next
         * - assets
         */
        "/((?!_next|favicon.ico|.*\\..*).*)",
    ],
};

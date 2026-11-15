import { NextResponse } from "next/server";
import { formatSignupOrigin, getSignupOriginCookie, readSignupOrigin } from "../signupOrigin";

const host = "www.imenuapp.com.br";
const visit = (path: string, headers?: Record<string, string>) => new Request(`https://${host}${path}`, {
    headers: { accept: "text/html", ...headers },
});

test("a later UTM leaves the first Google blog landing in place", () => {
    const first = visit("/blog/criar-cardapio-com-ia?untracked=ignore", { referer: "https://www.google.com.br/search?q=ignore" });
    const cookie = getSignupOriginCookie(first, new URL(first.url), host, null);
    expect(cookie).toEqual(expect.objectContaining({ httpOnly: true, domain: "imenuapp.com.br" }));
    const response = NextResponse.next();
    response.cookies.set(cookie!);
    const later = visit("/?utm_source=instagram", { cookie: response.headers.get("set-cookie")!.split(";")[0] });
    expect(getSignupOriginCookie(later, new URL(later.url), host, null)).toBeNull();
    const origin = readSignupOrigin(later, "imenuapp.com.br");
    expect(origin).toEqual({ path: "/blog/criar-cardapio-com-ia", source: null, referrer: "www.google.com.br", affiliate: null });
    expect(formatSignupOrigin(origin)).toBe("Google · /blog/criar-cardapio-com-ia");
});

test.each([
    ["/?utm_source=Instagram", null, "Instagram · utm_source=instagram"],
    ["/?af=joao", "joao", "Afiliado · af=joao"],
    ["/?af=unknown", null, "Direto"],
])("formats the signup origin for %s", (path, affiliate, expected) => {
    const request = visit(path);
    const cookie = getSignupOriginCookie(request, new URL(request.url), host, affiliate)!;
    const signup = visit("/api/restaurants/create", { cookie: `${cookie.name}=${cookie.value}` });
    expect(formatSignupOrigin(readSignupOrigin(signup, host))).toBe(expected);
    expect(readSignupOrigin(signup, "preview.imenuapp.com.br")).toBeNull();
});

test("ignores a prefetch, private path, or absent origin", () => {
    const prefetch = visit("/blog", { "sec-purpose": "prefetch" });
    expect(getSignupOriginCookie(prefetch, new URL(prefetch.url), host, null)).toBeNull();
    const privatePage = visit("/dev/crm");
    expect(getSignupOriginCookie(privatePage, new URL(privatePage.url), host, null)).toBeNull();
    expect(formatSignupOrigin(readSignupOrigin(privatePage, host))).toBeNull();
});

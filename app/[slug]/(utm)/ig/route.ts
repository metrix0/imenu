import { NextResponse } from "next/server";

export function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    const { slug } = params;

    return NextResponse.redirect(
        `https://imenuapp.com.br/${slug}?utm_source=instagram`,
        { status: 307 } // ou 302
    );
}

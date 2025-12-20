import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    return NextResponse.redirect(
        `https://imenuapp.com.br/${slug}?utm_source=whatsapp`,
        { status: 307 }
    );
}

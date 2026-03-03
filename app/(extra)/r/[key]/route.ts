import { NextResponse } from "next/server";


const redirectMap: Record<string, string> = {
    bombomGratis: "https://www.imenuapp.com.br/karamelo?p=2086aedb-576b-483a-a571-0de564ac63cb",
    FritasGratis: "https://www.imenuapp.com.br/mingos-burguer?p=b8cb4711-0515-4a34-ada9-226c5adc6b70"
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;
    const normalizedKey = key;

    if (!normalizedKey || !redirectMap[normalizedKey]) {
        return new NextResponse("Not found", { status: 404 });
    }

    const destination = redirectMap[normalizedKey];

    if (destination.startsWith("http")) {
        return NextResponse.redirect(destination, 308);
    }

    return NextResponse.redirect(
        new URL(destination, request.url),
        308
    );
}
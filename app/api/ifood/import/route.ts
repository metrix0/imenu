import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { restaurantId, url } = await req.json();

        console.log("📥 Dados recebidos na API:", { restaurantId, url });

        if (!url) {
            return NextResponse.json(
                { error: "URL ausente no body." },
                { status: 400 }
            );
        }

        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId ausente." },
                { status: 400 }
            );
        }

        // Por enquanto não tem lógica — só confirmamos que a API funciona
        return NextResponse.json(
            {
                status: "ok",
                received: { restaurantId, url },
                message: "Route funcionando corretamente."
            },
            { status: 200 }
        );
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Erro interno" },
            { status: 500 }
        );
    }
}

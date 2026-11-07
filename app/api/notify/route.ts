import { NextResponse } from "next/server";

import { sendNtfyNotification } from "@/lib/services/ntfy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
    const secret = process.env.CRON_SECRET?.trim();
    return Boolean(
        secret &&
            request.headers.get("authorization") === `Bearer ${secret}`
    );
}

async function notify(
    request: Request,
    input: { title?: unknown; message?: unknown; source?: unknown; severity?:unknown }
) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const title =
        typeof input.title === "string" ? input.title.trim() : "";
    const message =
        typeof input.message === "string" ? input.message.trim() : "";

    if (!message) {
        return NextResponse.json(
            { error: "Mensagem não informada." },
            { status: 400 }
        );
    }

    if (title.length > 200 || message.length > 4000) {
        return NextResponse.json(
            { error: "Notificação excede o limite permitido." },
            { status: 400 }
        );
    }

    try {
        await sendNtfyNotification({
            source: typeof input.source === "string" && input.source.trim() ? input.source.trim().slice(0,100) : "api/notify",
            severity: typeof input.severity === "string" && ["info","warning","error","critical"].includes(input.severity) ? input.severity : undefined,
            title: title || "iMenu",
            message,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[NOTIFY] Falha ao enviar notificação ntfy", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível enviar a notificação.",
            },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    return notify(request, {
        title: url.searchParams.get("title"),
        message: url.searchParams.get("message"),
        source: url.searchParams.get("source"),
        severity: url.searchParams.get("severity"),
    });
}

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "JSON inválido." },
            { status: 400 }
        );
    }

    const input =
        body && typeof body === "object"
            ? (body as { title?: unknown; message?: unknown; source?: unknown; severity?:unknown })
            : {};

    return notify(request, input);
}

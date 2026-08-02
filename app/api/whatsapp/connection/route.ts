import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
    buildWahaSessionName,
    ensureWahaSession,
    extractWahaPhone,
    getWahaQrCode,
    getWahaSession,
    logoutWahaSession,
    type WahaSession,
} from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectionAction = "connect" | "refresh_qr" | "disconnect";

type ConnectionRow = {
    restaurant_id: string;
    session_name: string;
    desired_state: "connected" | "disconnected";
    status: string;
    status_data: unknown;
    phone: string | null;
    push_name: string | null;
    qr_code_data: string | null;
    qr_updated_at: string | null;
    last_connected_at: string | null;
    last_disconnected_at: string | null;
    last_restart_at: string | null;
    last_event_at: string | null;
    last_error: string | null;
    updated_at: string;
};

const CONNECTION_SELECT = [
    "restaurant_id",
    "session_name",
    "desired_state",
    "status",
    "status_data",
    "phone",
    "push_name",
    "qr_code_data",
    "qr_updated_at",
    "last_connected_at",
    "last_disconnected_at",
    "last_restart_at",
    "last_event_at",
    "last_error",
    "updated_at",
].join(",");

function getBearerToken(request: NextRequest): string | null {
    const authorization = request.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

async function requireOwnedRestaurant(
    request: NextRequest,
    restaurantId: string
) {
    const token = getBearerToken(request);
    if (!token) {
        throw new Response("Unauthorized", { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
        throw new Response("Unauthorized", { status: 401 });
    }

    const { data: restaurant, error } = await supabase
        .from("restaurants")
        .select("id, name, url_slug")
        .eq("id", restaurantId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;
    if (!restaurant) {
        throw new Response("Restaurant not found", { status: 404 });
    }

    return { supabase, restaurant };
}

async function readConnection(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    restaurantId: string
): Promise<ConnectionRow | null> {
    const { data, error } = await supabase
        .from("whatsapp_connections")
        .select(CONNECTION_SELECT)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

    if (error) throw error;
    return (data as ConnectionRow | null) || null;
}

async function updateFromWahaSession({
    supabase,
    restaurantId,
    sessionName,
    session,
}: {
    supabase: ReturnType<typeof createSupabaseServerClient>;
    restaurantId: string;
    sessionName: string;
    session: WahaSession;
}): Promise<ConnectionRow> {
    const status = session.status || "STARTING";
    const qrCode =
        status === "SCAN_QR_CODE"
            ? await getWahaQrCode(sessionName)
            : null;
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
        restaurant_id: restaurantId,
        session_name: sessionName,
        desired_state: "connected",
        status,
        status_data: null,
        phone: extractWahaPhone(session.me?.id),
        push_name: session.me?.pushName || null,
        last_event_at: now,
        last_error: null,
        updated_at: now,
    };

    if (status === "SCAN_QR_CODE") {
        update.qr_code_data = qrCode;
        update.qr_updated_at = qrCode ? now : null;
    } else {
        update.qr_code_data = null;
        update.qr_updated_at = null;

        if (status === "WORKING") {
            update.last_connected_at = now;
        }
    }

    const { data, error } = await supabase
        .from("whatsapp_connections")
        .upsert(update, { onConflict: "restaurant_id" })
        .select(CONNECTION_SELECT)
        .single();

    if (error) throw error;
    return data as ConnectionRow;
}

function jsonError(error: unknown) {
    if (error instanceof Response) {
        return NextResponse.json(
            { error: error.statusText || "Request failed" },
            { status: error.status }
        );
    }

    console.error("[WHATSAPP_CONNECTION]", error);
    return NextResponse.json(
        {
            error:
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar a conexão.",
        },
        { status: 500 }
    );
}

export async function GET(request: NextRequest) {
    try {
        const restaurantId = request.nextUrl.searchParams.get("restaurantId");
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        const { supabase, restaurant } = await requireOwnedRestaurant(
            request,
            restaurantId
        );
        let connection = await readConnection(supabase, restaurantId);

        // One status reconciliation on page load. This is not interval polling:
        // it only prevents a stale "connected" badge when WAHA or its session
        // went offline without being able to send the final webhook.
        if (connection?.desired_state === "connected") {
            try {
                const session = await getWahaSession(connection.session_name);

                if (session) {
                    connection = await updateFromWahaSession({
                        supabase,
                        restaurantId,
                        sessionName: connection.session_name,
                        session,
                    });
                } else {
                    const now = new Date().toISOString();
                    const { error } = await supabase
                        .from("whatsapp_connections")
                        .update({
                            status: "FAILED",
                            qr_code_data: null,
                            qr_updated_at: null,
                            last_disconnected_at: now,
                            last_event_at: now,
                            last_error: "A sessão não foi encontrada no servidor do WhatsApp.",
                            updated_at: now,
                        })
                        .eq("restaurant_id", restaurantId);

                    if (error) throw error;
                    connection = await readConnection(supabase, restaurantId);
                }
            } catch (error) {
                console.warn(
                    "[WHATSAPP_CONNECTION] WAHA status reconciliation failed:",
                    error
                );

                const now = new Date().toISOString();
                const { error: updateError } = await supabase
                    .from("whatsapp_connections")
                    .update({
                        status: "FAILED",
                        qr_code_data: null,
                        qr_updated_at: null,
                        last_disconnected_at: now,
                        last_event_at: now,
                        last_error: "O servidor da conexão do WhatsApp está indisponível.",
                        updated_at: now,
                    })
                    .eq("restaurant_id", restaurantId);

                if (updateError) throw updateError;
                connection = await readConnection(supabase, restaurantId);
            }
        }

        return NextResponse.json({ restaurant, connection });
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const restaurantId = String(body?.restaurantId || "");
        const action = String(body?.action || "") as ConnectionAction;

        if (!restaurantId || !["connect", "refresh_qr", "disconnect"].includes(action)) {
            return NextResponse.json(
                { error: "Invalid request" },
                { status: 400 }
            );
        }

        const { supabase, restaurant } = await requireOwnedRestaurant(
            request,
            restaurantId
        );
        const existing = await readConnection(supabase, restaurantId);
        const sessionName =
            existing?.session_name || buildWahaSessionName(restaurantId);
        const now = new Date().toISOString();

        if (action === "disconnect") {
            const { error: disconnectStateError } = await supabase
                .from("whatsapp_connections")
                .upsert(
                    {
                        restaurant_id: restaurantId,
                        session_name: sessionName,
                        desired_state: "disconnected",
                        status: "STOPPED",
                        qr_code_data: null,
                        qr_updated_at: null,
                        last_disconnected_at: now,
                        last_error: null,
                        updated_at: now,
                    },
                    { onConflict: "restaurant_id" }
                );

            if (disconnectStateError) throw disconnectStateError;

            try {
                await logoutWahaSession(sessionName);
            } catch (error) {
                console.warn(
                    "[WHATSAPP_CONNECTION] WAHA logout returned an error:",
                    error
                );
            }

            const connection = await readConnection(supabase, restaurantId);
            return NextResponse.json({ restaurant, connection });
        }

        const { error: startingStateError } = await supabase
            .from("whatsapp_connections")
            .upsert(
                {
                    restaurant_id: restaurantId,
                    session_name: sessionName,
                    desired_state: "connected",
                    status: "STARTING",
                    qr_code_data: null,
                    qr_updated_at: null,
                    last_restart_at:
                        action === "refresh_qr"
                            ? now
                            : existing?.last_restart_at,
                    last_error: null,
                    updated_at: now,
                },
                { onConflict: "restaurant_id" }
            );

        if (startingStateError) throw startingStateError;

        let session: WahaSession;

        if (action === "refresh_qr") {
            // A fresh QR must discard the old WhatsApp authorization. Restarting
            // alone can keep a failed credential and return FAILED again.
            try {
                await logoutWahaSession(sessionName);
            } catch (error) {
                console.warn(
                    "[WHATSAPP_CONNECTION] Old WAHA session was already absent:",
                    error
                );
            }

            session = await ensureWahaSession(restaurantId, sessionName);
        } else {
            session = await ensureWahaSession(restaurantId, sessionName);
        }

        // WAHA can return STARTING before the first QR is ready. The webhook
        // updates this row through Realtime as soon as the status changes.
        if (session.status === "STARTING") {
            await new Promise((resolve) => setTimeout(resolve, 700));
            session = (await getWahaSession(sessionName)) || session;
        }

        const connection = await updateFromWahaSession({
            supabase,
            restaurantId,
            sessionName,
            session,
        });

        return NextResponse.json({ restaurant, connection });
    } catch (error) {
        return jsonError(error);
    }
}

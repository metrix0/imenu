import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
    buildWahaSessionName,
    ensureWahaSession,
    extractWahaPhone,
    getWahaQrCode,
    getWahaSession,
    logoutWahaSession,
    restartWahaSession,
    type WahaSession,
} from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectionAction = "connect" | "reconnect" | "refresh_qr" | "disconnect";

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

const CONNECTION_SELECT =
    "restaurant_id,session_name,desired_state,status,status_data,phone,push_name,qr_code_data,qr_updated_at,last_connected_at,last_disconnected_at,last_restart_at,last_event_at,last_error,updated_at" as const;

function parseConnectionRow(value: unknown): ConnectionRow {
    if (!value || typeof value !== "object") {
        throw new Error("Invalid WhatsApp connection response");
    }

    return value as ConnectionRow;
}

function getBearerToken(request: NextRequest): string | null {
    const authorization = request.headers.get("authorization") || "";
    return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function requireOwnedRestaurant(
    request: NextRequest,
    restaurantId: string
) {
    const token = getBearerToken(request);
    if (!token) throw new Response("Unauthorized", { status: 401 });

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
    return data ? parseConnectionRow(data) : null;
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
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
        restaurant_id: restaurantId,
        session_name: sessionName,
        desired_state: "connected",
        status,
        status_data: null,
        last_event_at: now,
        last_error: null,
        updated_at: now,
    };

    const phone = extractWahaPhone(session.me?.id);
    if (phone) update.phone = phone;
    if (session.me?.pushName) update.push_name = session.me.pushName;

    if (status === "SCAN_QR_CODE") {
        const qrCode = await getWahaQrCode(sessionName);
        update.qr_code_data = qrCode;
        update.qr_updated_at = qrCode ? now : null;
    } else {
        update.qr_code_data = null;
        update.qr_updated_at = null;

        if (status === "WORKING") {
            update.last_connected_at = now;
        } else if (status === "FAILED" || status === "STOPPED") {
            update.last_disconnected_at = now;
        }
    }

    const { data, error } = await supabase
        .from("whatsapp_connections")
        .upsert(update, { onConflict: "restaurant_id" })
        .select(CONNECTION_SELECT)
        .single();

    if (error) throw error;
    return parseConnectionRow(data);
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

        // Status checks must be read-only. Updating the WAHA session config while
        // merely opening this page can restart a healthy GOWS session and make the
        // UI incorrectly return to QR mode.
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
                            last_error:
                                "A sessão não foi encontrada no servidor do WhatsApp.",
                            updated_at: now,
                        })
                        .eq("restaurant_id", restaurantId);

                    if (error) throw error;
                    connection = await readConnection(supabase, restaurantId);
                }
            } catch (error) {
                // A temporary WAHA/API outage must not overwrite a valid connected
                // state in Supabase. Realtime or the next page load will reconcile it.
                console.warn(
                    "[WHATSAPP_CONNECTION] Read-only WAHA reconciliation failed:",
                    error
                );
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

        if (
            !restaurantId ||
            !["connect", "reconnect", "refresh_qr", "disconnect"].includes(action)
        ) {
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
            const { error } = await supabase
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

            if (error) throw error;

            try {
                await logoutWahaSession(sessionName);
            } catch (logoutError) {
                console.warn(
                    "[WHATSAPP_CONNECTION] WAHA logout returned an error:",
                    logoutError
                );
            }

            return NextResponse.json({
                restaurant,
                connection: await readConnection(supabase, restaurantId),
            });
        }

        const { error: startingError } = await supabase
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
                        action === "refresh_qr" || action === "reconnect"
                            ? now
                            : existing?.last_restart_at,
                    last_error: null,
                    updated_at: now,
                },
                { onConflict: "restaurant_id" }
            );

        if (startingError) throw startingError;

        if (action === "refresh_qr") {
            try {
                await logoutWahaSession(sessionName);
            } catch (logoutError) {
                console.warn(
                    "[WHATSAPP_CONNECTION] Old WAHA session was already absent:",
                    logoutError
                );
            }
        }

        let session: WahaSession;
        if (action === "reconnect") {
            const savedSession = await getWahaSession(sessionName);
            session = savedSession
                ? await restartWahaSession(sessionName)
                : await ensureWahaSession(restaurantId, sessionName);
        } else {
            session = await ensureWahaSession(restaurantId, sessionName);
        }

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

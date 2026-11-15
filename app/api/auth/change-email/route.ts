import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

const returnPath = "/restaurante/confirmar-alteracao-email";

export async function POST(request: Request) {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
        return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const auth = createSupabaseServerClient();
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user?.email || user.is_anonymous) {
        return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }
    if (email === user.email.toLowerCase()) {
        return NextResponse.json({ error: "O novo e-mail deve ser diferente do atual." }, { status: 400 });
    }

    // getUser verified the token before these claims are read.
    let sessionId: unknown;
    try {
        sessionId = decodeJwt(token).session_id;
    } catch {
        return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }
    if (typeof sessionId !== "string" || !/^[\da-f-]{36}$/i.test(sessionId)) {
        return NextResponse.json({ code: "reauthentication_needed" }, { status: 403 });
    }

    try {
        const permit = await query(
            `INSERT INTO imenu_private.email_change_authorizations (user_id, email, authorized_until)
             SELECT s.user_id, $2, clock_timestamp() + interval '30 seconds'
             FROM auth.sessions s
             WHERE s.user_id = $1 AND s.id = $3::uuid
               AND s.created_at >= now() - interval '5 minutes'
               AND EXISTS (
                   SELECT 1 FROM auth.mfa_amr_claims m
                   WHERE m.session_id = s.id AND m.authentication_method IN ('password', 'oauth', 'totp', 'mfa/phone', 'mfa/webauthn')
               )
             ON CONFLICT (user_id) DO UPDATE
             SET email = EXCLUDED.email, authorized_until = EXCLUDED.authorized_until
             WHERE imenu_private.email_change_authorizations.authorized_until <= clock_timestamp()`,
            [user.id, email, sessionId]
        );
        if (permit.rowCount === 0) {
            const pending = await query(`SELECT 1 FROM imenu_private.email_change_authorizations WHERE user_id = $1 AND authorized_until > clock_timestamp()`, [user.id]);
            return pending.rowCount ? NextResponse.json({ error: "Já existe uma solicitação em andamento." }, { status: 409 })
                : NextResponse.json({ code: "reauthentication_needed" }, { status: 403 });
        }

        const supabaseUrl = process.env.SUPABASE_URL!;
        const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
        const origin = new URL(request.url).origin;
        const allowedOrigins = ["https://imenuapp.com.br", "https://www.imenuapp.com.br", "https://preview.imenuapp.com.br"];
        const redirectTo = new URL(returnPath, allowedOrigins.includes(origin) ? origin : allowedOrigins[1]);
        const endpoint = new URL("/auth/v1/user", supabaseUrl);
        endpoint.searchParams.set("redirect_to", redirectTo.toString());
        const result = await fetch(endpoint, {
            method: "PUT",
            headers: { apikey: apiKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
            signal: AbortSignal.timeout(25000),
        });
        if (result.ok) return NextResponse.json({ ok: true });

        await query(
            `DELETE FROM imenu_private.email_change_authorizations WHERE user_id = $1 AND email = $2`,
            [user.id, email]
        );

        const failure = await result.json().catch(() => null);
        if (failure?.error_code === "email_exists" || failure?.error_code === "email_address_not_authorized") {
            return NextResponse.json({ error: "Este e-mail não está disponível." }, { status: result.status });
        }
        if (result.status === 429) {
            return NextResponse.json({ error: "Aguarde antes de solicitar outro link." }, { status: 429 });
        }
        return NextResponse.json({ error: "Não foi possível enviar o link. Tente novamente." }, { status: result.status });
    } catch {
        return NextResponse.json({ error: "Não foi possível solicitar a troca de e-mail." }, { status: 503 });
    }
}

// app/api/auth/delete-account/route.ts
import { NextResponse } from "next/server";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const access_token = body?.access_token;

    // Retornar genérico para os testes — eles esperam { error: "Unauthorized" }.
    if (!access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Supabase Admin Client (usa Service Role Key)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables for Supabase Admin");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Obtém o usuário logado pelo token (verificação de que o token é válido)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(access_token);

    // Para testes: retornar corpo genérico "Unauthorized"
    if (userError || !user) {
      console.error("Unable to retrieve user from token:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Never remove Auth while a restaurant (and potentially WAHA) still exists.
    const { count, error: restaurantsError } = await supabaseAdmin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (restaurantsError) {
      return NextResponse.json({ error: "Unable to check restaurants" }, { status: 500 });
    }
    if (count) {
      return NextResponse.json({ error: "Delete owned restaurants first" }, { status: 409 });
    }

    // 2. Deleta o usuário pelo Admin
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user from Auth:", deleteError);
      // Mantemos a mensagem do provedor no corpo 500 — test deverá aceitar
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Sucesso
    return NextResponse.json({ success: true, feedbackToken: issueFeedbackToken(supabaseServiceKey) });

  } catch (err: any) {
    console.error("Unexpected server error in delete-account:", err);
    return NextResponse.json({ error: "Unexpected server error", detail: err?.message ?? String(err) }, { status: 500 });
  }
}

const FEEDBACK_REASONS = new Set([
  "missing_feature", "technical_problems", "business_closed", "other",
]);

function signFeedback(payload: string, secret: string) {
  return createHmac("sha256", secret).update("imenu:account-deletion-feedback:" + payload).digest("hex");
}

function issueFeedbackToken(secret: string) {
  const payload = randomUUID() + "." + (Date.now() + 30 * 60 * 1000);
  return payload + "." + signFeedback(payload, secret);
}

function verifyFeedbackToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || !/^[0-9a-f-]{36}\.[0-9]{13}\.[0-9a-f]{64}$/.test(token)) return null;
  const [id, expires, signature] = token.split(".");
  if (Number(expires) < Date.now()) return null;
  const expected = signFeedback(id + "." + expires, secret);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex")) ? id : null;
}

// Only a token issued after successful deletion can submit feedback.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  const id = verifyFeedbackToken(body?.token, secret);
  if (!id) return NextResponse.json({ error: "Invalid feedback token" }, { status: 401 });
  if (typeof body?.reason !== "string" || !FEEDBACK_REASONS.has(body.reason) ||
      (body.feedback !== undefined && (typeof body.feedback !== "string" || body.feedback.length > 2000))) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }
  const feedback = body.feedback?.trim() || null;
  if (body.reason === "missing_feature" && !feedback) {
    return NextResponse.json({ error: "Missing feature details required" }, { status: 400 });
  }

  try {
    const { query } = await import("@/lib/database/sql");
    await query(
      "INSERT INTO public.account_deletion_feedback (id, reason, feedback) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [id, body.reason, feedback]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion feedback storage failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Unable to save feedback" }, { status: 500 });
  }
}

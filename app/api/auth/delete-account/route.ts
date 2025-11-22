// app/api/auth/delete-account/route.ts
import { NextResponse } from "next/server";
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

    // 2. Deleta o usuário pelo Admin
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user from Auth:", deleteError);
      // Mantemos a mensagem do provedor no corpo 500 — test deverá aceitar
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Sucesso
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Unexpected server error in delete-account:", err);
    return NextResponse.json({ error: "Unexpected server error", detail: err?.message ?? String(err) }, { status: 500 });
  }
}

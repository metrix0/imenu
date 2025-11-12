// app/api/auth/create-restaurant-user/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";


const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service_key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabase_url, service_key);

export async function POST(request: Request) {
    const { email, password, nome, telefone, restaurantId } = await request.json();

    if (!email || !password || !nome || !telefone || !restaurantId) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, 
        });

        if (authError) {
            console.error("Erro no Supabase Auth:", authError);
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const newUserId = authData.user.id;

        const { error: dbError } = await supabaseAdmin
            .from("restaurants")
            .update({
                user_id: newUserId,      
                name: nome,      
                phone: telefone 
            })
            .eq("id", restaurantId); 

        if (dbError) {
            console.error("Erro ao linkar restaurante:", dbError);
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            return NextResponse.json({ error: "Falha ao atualizar o restaurante." }, { status: 500 });
        }

        const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });

        if (sessionError) {
             console.warn("Usuário criado, mas login automático falhou:", sessionError.message);
        }

        return NextResponse.json({ 
            success: true, 
            user: authData.user,
            session: sessionData.session
        });

    } catch (error) {
        console.error("Erro inesperado:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
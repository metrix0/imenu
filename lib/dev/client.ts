"use client";

import { supabase } from "@/lib/database/supabaseClient";

export async function devJson<T>(url: string, init?: RequestInit): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Faça login para continuar.");
    const response = await fetch(url, {
        ...init, cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}`, ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.");
    return payload as T;
}

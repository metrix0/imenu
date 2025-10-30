"use client";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const router = useRouter();

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr(error.message);
        else router.replace("/admin");
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <img src="https://mjogdsnxbwhbqcoijrwt.supabase.co/storage/v1/object/public/menu-images/menu-images/download%20(4).png" alt="Product" />

            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
                <h1 className="text-2xl font-bold">Admin</h1>
                {err && <p className="text-red-600">{err}</p>}
                <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                <input className="border p-2 w-full" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                <button className="bg-black text-white px-4 py-2 rounded">Entrar</button>
            </form>
        </main>
    );
}

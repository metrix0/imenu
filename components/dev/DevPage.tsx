"use client";

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";

export default function DevPage({ title, children }: { title: string; children: ReactNode }) {
    const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");
    useEffect(() => {
        let active = true;
        void supabase.auth.getUser().then(({ data }) => {
            if (active) setAccess(data.user?.email?.toLowerCase() === "joaovralmeida@hotmail.com" ? "allowed" : "denied");
        }).catch(() => { if (active) setAccess("denied"); });
        return () => { active = false; };
    }, []);
    return <main className="min-h-screen bg-[#f7f8fa] px-4 py-7 text-[#1d1d1d] sm:px-6">
        <div className="mx-auto max-w-[1500px] space-y-6">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {access === "loading" ? <Loader /> : access === "denied" ? <div className="space-y-4"><p>Acesso restrito à administração.</p><Button onClick={() => { window.location.href = "/restaurante/login"; }}>Entrar</Button></div> : children}
        </div>
    </main>;
}

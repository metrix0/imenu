"use client";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [checked, setChecked] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Always allow login page
        if (pathname === "/admin/login") {
            setChecked(true);
            return;
        }

        // For all other admin routes, require session
        supabase.auth.getSession().then(({ data }) => {
            if (!data.session) router.replace("/admin/login");
            setChecked(true);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session && pathname !== "/admin/login") router.replace("/admin/login");
        });
        return () => {
            sub?.subscription.unsubscribe();
        };
    }, [pathname, router]);

    if (!checked) return <div>Carregando...</div>; // fallback

    return <>{children}</>;
}

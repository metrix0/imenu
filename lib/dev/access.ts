import { supabase } from "@/lib/database/supabaseClient";

export const DEV_EMAIL = "joaovralmeida@hotmail.com";
export type DevAccess = "checking" | "allowed" | "signed-out" | "forbidden" | "error";

export function watchDevAccess(update: (access: DevAccess) => void) {
    let active = true, revision = 0;
    let verifiedUserId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const verify = async () => {
        const current = ++revision;
        if (!verifiedUserId) update("checking");
        try {
            const { data, error } = await supabase.auth.getUser();
            if (!active || current !== revision) return;
            const access: DevAccess = error || !data.user ? "signed-out" : data.user.email?.trim().toLowerCase() === DEV_EMAIL ? "allowed" : "forbidden";
            verifiedUserId = access === "allowed" ? data.user?.id || null : null;
            update(access);
        } catch {
            if (active && current === revision) { verifiedUserId = null; update("error"); }
        }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        ++revision;
        clearTimeout(timer);
        if (!session) { verifiedUserId = null; update("signed-out"); return; }
        if (!verifiedUserId || session.user?.id !== verifiedUserId || session.user?.email?.trim().toLowerCase() !== DEV_EMAIL) {
            verifiedUserId = null;
            update("checking");
        }
        timer = setTimeout(() => { void verify(); }, 0);
    });

    void verify();
    return { retry: verify, unsubscribe() { active = false; ++revision; clearTimeout(timer); subscription.unsubscribe(); } };
}

import { supabase } from "@/lib/database/supabaseClient";
export const DEV_EMAIL = "joaovralmeida@hotmail.com";
export type DevAccess = "checking" | "allowed" | "signed-out" | "forbidden" | "error";
export function watchDevAccess(update: (access: DevAccess) => void) {
 let active = true, revision = 0; let timer: ReturnType<typeof setTimeout> | undefined;
 const verify = async () => { const current = ++revision; update("checking"); try { const { data, error } = await supabase.auth.getUser(); if (active && current === revision) update(error || !data.user ? "signed-out" : data.user.email?.trim().toLowerCase() === DEV_EMAIL ? "allowed" : "forbidden"); } catch { if (active && current === revision) update("error"); } };
 const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!active) return; ++revision; clearTimeout(timer); update(session ? "checking" : "signed-out"); if (session) timer = setTimeout(() => { void verify(); }, 0); });
 void verify(); return { retry: verify, unsubscribe() { active = false; ++revision; clearTimeout(timer); subscription.unsubscribe(); } };
}

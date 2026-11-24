// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error("Supabase public envs missing");

const authStorageKey = process.env.NEXT_PUBLIC_SUPABASE_AUTH_STORAGE_KEY
    || `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient(url, anon, {
    auth: {
        storageKey: authStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        // The app handles signup confirmation fragments itself so the tokens
        // cannot be consumed and removed before the confirmation UI runs.
        detectSessionInUrl: false,
    },
});

export function clearCachedAuthSession() {
    for (const suffix of ["", "-code-verifier", "-user"]) {
        window.localStorage.removeItem(authStorageKey + suffix);
    }
}

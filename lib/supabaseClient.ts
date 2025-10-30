import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !anon) throw new Error("Supabase public envs missing");

export const supabase = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
});

import { createClient } from "@supabase/supabase-js";

export const createSupabaseServerClient = (fetchOverride?: typeof fetch) => {
    const url = process.env.SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    return createClient(url, service, {
        ...(fetchOverride ? { global: { fetch: fetchOverride } } : {}),
        // Server clients must not keep requests alive through auth refresh timers.
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
};

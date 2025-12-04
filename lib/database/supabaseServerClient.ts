import { createClient } from "@supabase/supabase-js";

export const createSupabaseServerClient = () => {
    const url = process.env.SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    return createClient(url, service);
};

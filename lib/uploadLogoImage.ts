
import { supabase } from "@/lib/supabaseClient";

export async function uploadLogoImage(file: File): Promise<string> {
    const key = `${crypto.randomUUID()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from("restaurant-logos")
        .upload(key, file, { upsert: false });
    if (error) throw error;
    return key;
}

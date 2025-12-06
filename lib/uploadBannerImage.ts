import { supabase } from "@/lib/database/supabaseClient";

/**
 * Upload de imagem de banner do menu.
 * Salva no bucket "menu-banners".
 */
export async function uploadBannerImage(file: File): Promise<string> {
    const key = `${crypto.randomUUID()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from("menu-banners")
        .upload(key, file, { upsert: false });
    if (error) throw error;
    return key;
}

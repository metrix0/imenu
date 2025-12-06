import { supabase } from "@/lib/database/supabaseClient";

export async function uploadFullMenuImageAI(
    file: File,
    returnUrl: boolean = false
): Promise<string> {
    const key = `${crypto.randomUUID()}-${file.name}`;

    const { data, error } = await supabase.storage
        .from("full-menu-images-ai")
        .upload(key, file, { upsert: false });

    if (error) throw error;

    if (!returnUrl) {
        return key; // just return the storage key
    }

    // Generate public URL from key
    const { data: urlData } = supabase.storage
        .from("full-menu-images-ai")
        .getPublicUrl(key);

    return urlData.publicUrl;
}

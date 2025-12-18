// lib/uploadMenuImage.ts
import { supabase } from "@/lib/database/supabaseClient";

export async function uploadMenuImage(file: File): Promise<string> {
    const key = `menu-images/${crypto.randomUUID()}-${file.name}`;
    const { data, error } = await supabase.storage
        .from("menu-images")
        .upload(key, file, { upsert: false });
    if (error) throw error;
    return key;
}

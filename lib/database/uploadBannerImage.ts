import { supabase } from "@/lib/database/supabaseClient";
import { compressImageForUpload } from "@/lib/utils/compressImageForUpload";

/**
 * Upload de imagem de banner do menu.
 * Redimensiona e comprime antes de salvar no bucket "menu-banners".
 */
export async function uploadBannerImage(file: File): Promise<string> {
    const optimizedFile = await compressImageForUpload(file, {
        maxWidth: 1920,
        maxHeight: 1080,
        targetBytes: 450 * 1024,
        initialQuality: 0.84,
        minQuality: 0.56,
        outputType: "image/webp",
    });

    const key = `${crypto.randomUUID()}-${optimizedFile.name}`;

    const { error } = await supabase.storage
        .from("menu-banners")
        .upload(key, optimizedFile, {
            upsert: false,
            contentType: optimizedFile.type,
            cacheControl: "31536000",
        });

    if (error) throw error;
    return key;
}

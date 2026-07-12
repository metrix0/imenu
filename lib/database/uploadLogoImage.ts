import { supabase } from "@/lib/database/supabaseClient";
import { compressImageForUpload } from "@/lib/utils/compressImageForUpload";

export async function uploadLogoImage(file: File): Promise<string> {
    const optimizedFile = await compressImageForUpload(file, {
        maxWidth: 640,
        maxHeight: 640,
        targetBytes: 200 * 1024,
        initialQuality: 0.86,
        minQuality: 0.58,
        outputType: "image/webp",
    });

    const key = `${crypto.randomUUID()}-${optimizedFile.name}`;

    const { error } = await supabase.storage
        .from("restaurant-logos")
        .upload(key, optimizedFile, {
            upsert: false,
            contentType: optimizedFile.type,
            cacheControl: "31536000",
        });

    if (error) throw error;
    return key;
}

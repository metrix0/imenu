import { supabase } from "@/lib/database/supabaseClient";
import { compressImageForUpload, type ImageCompressionOptions } from "@/lib/utils/compressImageForUpload";

export async function uploadOptimizedRestaurantImage(
    file: File,
    bucket: "restaurant-logos" | "menu-banners",
    options: ImageCompressionOptions
): Promise<string> {
    const optimizedFile = await compressImageForUpload(file, options);
    const key = `${crypto.randomUUID()}-${optimizedFile.name}`;
    const { error } = await supabase.storage
        .from(bucket)
        .upload(key, optimizedFile, {
            upsert: false,
            contentType: optimizedFile.type,
            cacheControl: "31536000",
        });
    if (error) throw error;
    return key;
}

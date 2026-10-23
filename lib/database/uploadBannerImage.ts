import { uploadOptimizedRestaurantImage } from "@/lib/database/uploadOptimizedRestaurantImage";

/**
 * Upload de imagem de banner do menu.
 * Redimensiona e comprime antes de salvar no bucket "menu-banners".
 */
export async function uploadBannerImage(file: File): Promise<string> {
    return uploadOptimizedRestaurantImage(file, "menu-banners", {
        maxWidth: 1920,
        maxHeight: 1080,
        targetBytes: 450 * 1024,
        initialQuality: 0.84,
        minQuality: 0.56,
        outputType: "image/webp",
    });
}

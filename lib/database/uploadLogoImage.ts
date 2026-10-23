import { uploadOptimizedRestaurantImage } from "@/lib/database/uploadOptimizedRestaurantImage";

export async function uploadLogoImage(file: File): Promise<string> {
    return uploadOptimizedRestaurantImage(file, "restaurant-logos", {
        maxWidth: 640,
        maxHeight: 640,
        targetBytes: 200 * 1024,
        initialQuality: 0.86,
        minQuality: 0.58,
        outputType: "image/webp",
    });
}

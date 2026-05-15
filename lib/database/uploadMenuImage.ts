// lib/uploadMenuImage.ts
import { supabase } from "@/lib/database/supabaseClient";

async function convertToWebp500(file: File): Promise<Blob> {
    const imageBitmap = await createImageBitmap(file);

    const maxSize = 500;
    const scale = Math.min(
        maxSize / imageBitmap.width,
        maxSize / imageBitmap.height,
        1
    );

    const width = Math.round(imageBitmap.width * scale);
    const height = Math.round(imageBitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    ctx.drawImage(imageBitmap, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Failed to convert image to WebP"));
                    return;
                }

                resolve(blob);
            },
            "image/webp",
            0.8
        );
    });
}

function sanitizeFileName(name: string): string {
    return name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function uploadMenuImage(file: File): Promise<string> {
    const webpBlob = await convertToWebp500(file);

    const safeName = sanitizeFileName(file.name);
    const key = `menu-images/${crypto.randomUUID()}-${safeName}.webp`;

    const { error } = await supabase.storage
        .from("menu-images")
        .upload(key, webpBlob, {
            upsert: false,
            contentType: "image/webp",
            cacheControl: "31536000",
        });

    if (error) throw error;

    return key;
}
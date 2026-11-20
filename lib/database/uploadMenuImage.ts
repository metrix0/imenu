// lib/uploadMenuImage.ts
import { supabase } from "@/lib/database/supabaseClient";
import { MENU_GALLERY_IMAGE_PREFIX, MENU_IMAGE_PREFIX } from "@/lib/menu/itemImages";

async function compressMenuImage500(file: File): Promise<Blob> {
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
                if (blob?.type === "image/webp") {
                    resolve(blob);
                    return;
                }

                // Browsers without WebP encoding can silently return PNG.
                // Use JPEG instead, filling transparency with white.
                ctx.globalCompositeOperation = "destination-over";
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, width, height);

                canvas.toBlob(
                    (jpegBlob) => {
                        if (jpegBlob?.type !== "image/jpeg") {
                            reject(new Error("Failed to convert image to a supported format"));
                            return;
                        }

                        resolve(jpegBlob);
                    },
                    "image/jpeg",
                    0.8
                );
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

export async function uploadMenuImage(
    file: File,
    restaurantId?: string | null,
    prefix: typeof MENU_IMAGE_PREFIX | typeof MENU_GALLERY_IMAGE_PREFIX = MENU_IMAGE_PREFIX,
): Promise<string> {
    const imageBlob = await compressMenuImage500(file);
    return storeMenuImage(imageBlob, file.name, restaurantId, prefix);
}

async function storeMenuImage(
    imageBlob: Blob,
    name: string,
    restaurantId: string | null | undefined,
    prefix: string,
): Promise<string> {
    const extension = imageBlob.type === "image/webp" ? "webp" : imageBlob.type === "image/png" ? "png" : "jpg";
    const safeName = sanitizeFileName(name);

    // Identical uploads within a restaurant share a single Storage object.
    // Keep the previous unique-name behavior if the restaurant isn't known yet.
    const hasRestaurant = !!restaurantId && /^[0-9a-f-]{36}$/i.test(restaurantId);
    const digest = hasRestaurant
        ? await crypto.subtle.digest("SHA-256", await imageBlob.arrayBuffer())
        : null;
    const hash = digest
        ? Array.from(new Uint8Array(digest), (byte) =>
              byte.toString(16).padStart(2, "0")
          ).join("")
        : null;
    const key = hash
        ? `${prefix}/${restaurantId}/${hash}.${extension}`
        : `${prefix}/${crypto.randomUUID()}-${safeName}.${extension}`;

    const { error } = await supabase.storage
        .from("menu-images")
        .upload(key, imageBlob, {
            upsert: false,
            contentType: imageBlob.type,
            cacheControl: "31536000",
        });

    // A duplicate hash means the identical file was already uploaded.
    if (
        error &&
        !(
            hash &&
            "statusCode" in error &&
            String(error.statusCode) === "409"
        )
    ) {
        throw error;
    }

    return key;
}

export async function copyCoverToGallery(path: string, restaurantId: string, itemId: string): Promise<string> {
    if (!path.startsWith(`${MENU_IMAGE_PREFIX}/`)) return path;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Entre novamente para mover a foto principal.");

    const params = new URLSearchParams({ restaurantId, itemId });
    const response = await fetch(`/api/menu/item-media?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || typeof result?.path !== "string") {
        throw new Error(result?.error || "Não foi possível mover a foto principal.");
    }
    return result.path;
}

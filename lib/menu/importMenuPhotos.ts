import { createHash } from "node:crypto";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { downloadPublicMenuPhoto, type MenuPhoto } from "@/lib/menu/readPublicMenuLink";

const MAX_PHOTOS = 100;
const PHOTO_WORKERS = 6;
const PHOTO_BATCH_TIMEOUT_MS = 22_000;
const PHOTO_DOWNLOAD_TIMEOUT_MS = 6000;

const normalizeName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

export async function importMenuPhotos(
    restaurantId: string,
    items: { name: string; image_path: string | null }[],
    photos: MenuPhoto[]
) {
    const photosByName = new Map<string, MenuPhoto>();
    for (const photo of photos) {
        for (const name of photo.names) {
            const key = normalizeName(name);
            const previous = photosByName.get(key);
            if (key && (!previous || previous.area < photo.area)) photosByName.set(key, photo);
        }
    }

    const nameCounts = new Map<string, number>();
    for (const item of items) {
        const key = normalizeName(item.name);
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    const itemsByUrl = new Map<string, typeof items>();
    for (const item of items) {
        const key = normalizeName(item.name);
        const photo = photosByName.get(key);
        if (!photo || nameCounts.get(key) !== 1) continue;
        const linkedItems = itemsByUrl.get(photo.url);
        if (linkedItems) linkedItems.push(item);
        else if (itemsByUrl.size < MAX_PHOTOS) itemsByUrl.set(photo.url, [item]);
    }
    if (!itemsByUrl.size) return;

    const jobs = itemsByUrl.entries();
    const batch = AbortSignal.timeout(PHOTO_BATCH_TIMEOUT_MS);
    const storage = createSupabaseServerClient((input, init) => fetch(input, { ...init, signal: batch }))
        .storage.from("menu-images");
    let failed = 0;

    async function savePhotos() {
        for (const [url, linkedItems] of jobs) {
            if (batch.aborted) return;
            try {
                const signal = AbortSignal.any([batch, AbortSignal.timeout(PHOTO_DOWNLOAD_TIMEOUT_MS)]);
                const bytes = await downloadPublicMenuPhoto(url, signal);
                const image = await sharp(bytes, { limitInputPixels: 40_000_000 })
                    .rotate().resize(500, 500, { fit: "inside", withoutEnlargement: true })
                    .webp({ quality: 80 }).toBuffer();
                if (batch.aborted) return;
                const hash = createHash("sha256").update(image).digest("hex");
                const path = `menu-images/${restaurantId}/${hash}.webp`;
                const { error } = await storage.upload(path, image, {
                    upsert: false,
                    contentType: "image/webp",
                    cacheControl: "31536000",
                });
                if (error && !("statusCode" in error && String(error.statusCode) === "409") &&
                    !("status" in error && error.status === 409)) throw error;

                for (const item of linkedItems) item.image_path = path;
            } catch {
                failed++;
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(PHOTO_WORKERS, itemsByUrl.size) }, savePhotos));
    if (failed || batch.aborted) console.warn("[SCAN_MENU] Algumas fotos do cardápio não puderam ser copiadas.");
}

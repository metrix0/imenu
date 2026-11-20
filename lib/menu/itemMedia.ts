import type { SupabaseClient } from "@supabase/supabase-js";
import { getMenuItemImageUrl } from "./itemImages";

export const MAX_ITEM_MEDIA = 3;
export const MENU_VIDEO_BUCKET = "menu-videos";
export const MAX_MENU_VIDEO_MB = 50;
export const MAX_MENU_VIDEO_BYTES = MAX_MENU_VIDEO_MB * 1024 * 1024;
export const MENU_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export function isMenuVideoType(value: string): boolean {
    return MENU_VIDEO_TYPES.some(type => type === value);
}

export type ItemMedia = { type: "image" | "video"; path: string };
export type PublicItemMedia = { type: ItemMedia["type"]; url: string };

export function readItemMedia(value: unknown): ItemMedia[] {
    if (!Array.isArray(value)) return [];

    const media: ItemMedia[] = [];
    for (const entry of value) {
        if (!entry || typeof entry.path !== "string" || !entry.path) continue;
        if (entry.type !== "image" && entry.type !== "video") continue;
        if (entry.type === "video" && media.some(({ type }) => type === "video")) continue;
        media.push({ type: entry.type, path: entry.path });
        if (media.length === MAX_ITEM_MEDIA - 1) break;
    }
    return media;
}

export function getPublicItemMedia(
    supabase: Pick<SupabaseClient, "storage">,
    media: unknown,
): PublicItemMedia[] {
    return readItemMedia(media).flatMap(({ type, path }) => {
        const url = type === "image"
            ? getMenuItemImageUrl(supabase, path)
            : supabase.storage.from(MENU_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
        return url ? [{ type, url }] : [];
    });
}

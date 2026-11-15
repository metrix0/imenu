import type { SupabaseClient } from "@supabase/supabase-js";

export const MENU_EXAMPLE_IMAGES = {
    cola: "/images/menu-examples/coca-cola-350ml.webp",
    pizza: "/images/menu-examples/pizza-de-exemplo.webp",
} as const;

export function isMenuExampleImage(path: string): boolean {
    return path === MENU_EXAMPLE_IMAGES.cola || path === MENU_EXAMPLE_IMAGES.pizza;
}

export function getMenuItemImageUrl(
    supabase: Pick<SupabaseClient, "storage">,
    path: string | null | undefined,
): string | null {
    if (!path) return null;
    if (isMenuExampleImage(path)) return path;
    return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
}

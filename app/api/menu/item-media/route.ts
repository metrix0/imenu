import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { RestaurantOwnerAuthError, requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { MENU_GALLERY_IMAGE_PREFIX, MENU_IMAGE_PREFIX } from "@/lib/menu/itemImages";
import { readItemMedia } from "@/lib/menu/itemMedia";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MOVE_ERROR = "Não foi possível mover a foto principal.";

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") ?? "";
    const itemId = searchParams.get("itemId") ?? "";
    if (!UUID.test(restaurantId) || !UUID.test(itemId)) {
        return NextResponse.json({ error: "Item inválido." }, { status: 400 });
    }

    try {
        await requireRestaurantOwner(request, restaurantId);
        if (!(await hasIMenuPlusAccess(restaurantId))) {
            return NextResponse.json({ error: "Múltiplas fotos por item são exclusivas do iMenu Plus." }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const path = body?.path;
        const extension = typeof path === "string" && path.match(/\.(jpe?g|png|webp)$/i)?.[1];
        if (!extension || !path.startsWith(MENU_IMAGE_PREFIX + "/")) {
            return NextResponse.json({ error: "Foto inválida." }, { status: 400 });
        }
        const supabase = createSupabaseServerClient();
        const { data: item, error } = await supabase.from("items")
            .select("image_path,gallery_media")
            .eq("restaurant_id", restaurantId)
            .eq("id", itemId)
            .maybeSingle();
        if (error) throw error;

        const referenced = item && (item.image_path === path ||
            readItemMedia(item.gallery_media).some(media => media.type === "image" && media.path === path));
        if (!referenced) return NextResponse.json({ error: MOVE_ERROR }, { status: 409 });

        // Legacy cleanup does not track gallery references under the cover prefix.
        const sourceKey = createHash("sha256").update(path).digest("hex");
        const destination = `${MENU_GALLERY_IMAGE_PREFIX}/${restaurantId}/legacy-${sourceKey}.${extension.toLowerCase()}`;
        const bucket = supabase.storage.from("menu-images");
        const { error: copyError } = await bucket.copy(path, destination);
        if (copyError) {
            const { data: alreadyCopied } = await bucket.exists(destination);
            if (!alreadyCopied) throw copyError;
        }
        return NextResponse.json({ path: destination });
    } catch (error) {
        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[item-media] Could not copy item cover:", error);
        return NextResponse.json({ error: MOVE_ERROR }, { status: 502 });
    }
}

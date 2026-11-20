import { supabase } from "@/lib/database/supabaseClient";
import { MAX_MENU_VIDEO_BYTES, MAX_MENU_VIDEO_MB, isMenuVideoType } from "@/lib/menu/itemMedia";

export async function uploadMenuVideo(file: File, restaurantId: string): Promise<string> {
    if (!isMenuVideoType(file.type)) {
        throw new Error("Escolha um vídeo MP4, MOV ou WebM.");
    }
    if (file.size > MAX_MENU_VIDEO_BYTES || file.size === 0) {
        throw new Error(`Escolha um vídeo de até ${MAX_MENU_VIDEO_MB} MB.`);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Entre novamente para enviar um vídeo.");

    const response = await fetch(`/api/menu/item-video?restaurantId=${encodeURIComponent(restaurantId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": file.type },
        body: file,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.path !== "string") {
        throw new Error(result?.error || "Não foi possível enviar o vídeo.");
    }
    return result.path;
}

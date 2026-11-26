"use client";
import { useEffect, useRef, useState } from "react";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { buildMobileReceiptPdf, parseMobilePrintSettings, type MobilePrintSettings, type ReceiptData } from "@/lib/printer/mobileReceipt";

export function useMobilePrintSettings(restaurantId: string | null | undefined) {
    const [loaded, setLoaded] = useState<{ id: string; settings: MobilePrintSettings } | null>(null);
    useEffect(() => {
        if (!restaurantId) return;
        let active = true;
        let requestId = 0;
        const refresh = async () => {
            const id = ++requestId;
            const { data, error } = await supabase.from("restaurants").select("mobile_print_settings").eq("id", restaurantId).single();
            if (active && id === requestId) setLoaded(error ? null : { id: restaurantId, settings: parseMobilePrintSettings(data?.mobile_print_settings) });
        };
        void refresh();
        window.addEventListener("focus", refresh);
        return () => { active = false; window.removeEventListener("focus", refresh); };
    }, [restaurantId]);
    return loaded && loaded.id === restaurantId ? loaded.settings : null;
}
export function downloadReceipt(data: ReceiptData, settings: MobilePrintSettings, filename: string) {
    const blob = new Blob([buildMobileReceiptPdf(data, settings)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
export default function MobilePrintButton({ restaurantId, orderId, settings, iconOnly = false }: {
    restaurantId: string; orderId: string; settings: MobilePrintSettings; iconOnly?: boolean;
}) {
    const busy = useRef(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const print = async () => {
        if (busy.current || !settings.enabled) return;
        busy.current = true; setLoading(true); setError("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
            // Reuse the Windows app's authorized, read-only receipt operation. No print jobs are created.
            const response = await fetch("/api/printer", {
                method: "POST", cache: "no-store",
                headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
                body: JSON.stringify({ action: "receipt", restaurant_id: restaurantId, order_id: orderId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Não foi possível carregar a comanda.");
            const receipt = data as ReceiptData;
            if (!receipt.order || !Array.isArray(receipt.items) || !Array.isArray(receipt.subitems)) throw new Error("Comanda inválida.");
            const suffix = String(receipt.order.display_id ?? orderId).replace(/[^a-zA-Z0-9_-]/g, "-");
            downloadReceipt(receipt, settings, "comanda-" + suffix + ".pdf");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível baixar a comanda.");
        } finally { busy.current = false; setLoading(false); }
    };
    return <>
        <Button type="button" variant="secondary" className={iconOnly ? "px-4 shrink-0" : ""} title="Baixar comanda (PDF)"
            aria-label="Baixar comanda (PDF)" aria-busy={loading} disabled={loading} onClick={() => void print()}>
            <PanelIcon icon={faPrint} className={(iconOnly ? "" : "mr-2 ") + (loading ? "opacity-50" : "")} />
            {!iconOnly && "Imprimir"}
        </Button>
        {error && <Toast message={error} type="error" onClose={() => setError("")} />}
    </>;
}

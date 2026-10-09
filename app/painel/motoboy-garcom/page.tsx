"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faBellConcierge, faLock, faTruck } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import { supabase } from "@/lib/database/supabaseClient";
import { hasQrTableAccess } from "@/lib/qr-table/types";

export default function StaffPanelsPage() {
    const router = useRouter();
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [waiterAccess, setWaiterAccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [salesOpen, setSalesOpen] = useState(false);

    const loadAccess = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/restaurante/login");
                return;
            }
            const { data: restaurant, error: restaurantError } = await supabase
                .from("restaurants").select("id").eq("user_id", session.user.id).maybeSingle();
            if (restaurantError) throw restaurantError;
            if (!restaurant) throw new Error("Restaurante não encontrado.");
            setRestaurantId(restaurant.id);
            const { data: addon, error: addonError } = await supabase
                .from("restaurant_addons").select("status, current_period_ends_at")
                .eq("restaurant_id", restaurant.id).eq("product_key", "qr_code_mesa").maybeSingle();
            if (addonError) throw addonError;
            setWaiterAccess(hasQrTableAccess(addon));
        } catch {
            setError("Não foi possível carregar os painéis.");
            setWaiterAccess(false);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { void loadAccess(); }, [loadAccess]);

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader /></div>;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Motoboy/Garçom</h1>
            {error ? <Card><p className="text-sm text-red-700">{error}</p><Button className="mt-4" onClick={() => void loadAccess()}>Tentar novamente</Button></Card> : (
                <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => waiterAccess ? window.open("/garcom", "_blank", "noopener,noreferrer") : setSalesOpen(true)}>
                        <FontAwesomeIcon icon={faBellConcierge} className="mr-2" />
                        Painel Garçom
                        {!waiterAccess && <FontAwesomeIcon icon={faLock} className="ml-2" />}
                    </Button>
                    <Button variant="secondary" onClick={() => window.open("/motoboy", "_blank", "noopener,noreferrer")}>
                        <FontAwesomeIcon icon={faTruck} className="mr-2" />
                        Painel Motoboy
                    </Button>
                </div>
            )}
            {restaurantId && <QrCodeMesaSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} restaurantId={restaurantId} source="mesas" onPaid={loadAccess} />}
        </div>
    );
}

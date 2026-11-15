"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IaPlusProductCard from "@/components/restaurant-owner/ia-vendas/IaPlusProductCard";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import { capturePosthogLightweight } from "@/lib/api/instrumentation-client";
import { usePlusExposure } from "@/lib/analytics/plusExposure";
import { IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
import "../../../painel/planos/planos.css";

type Restaurant = { id: string; url_slug: string | null; first_time: boolean };

export default function OnboardingPlusPage() {
    const router = useRouter();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [eligible, setEligible] = useState(false);
    const [checkout, setCheckout] = useState(false);
    const exposureRef = usePlusExposure("onboarding_complete", eligible && !loading && !checkout);

    const panelUrl = (store: Restaurant) =>
        `/painel?onboarding=complete&menu=${encodeURIComponent(store.url_slug || store.id)}`;

    useEffect(() => {
        let canceled = false;
        void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.replace("/restaurante/login"); return; }
            const { data, error } = await supabase.from("restaurants")
                .select("id,url_slug,first_time").eq("user_id", session.user.id).maybeSingle();
            if (canceled) return;
            if (error || !data) { setLoading(false); return; }
            if (data.first_time !== false) { router.replace("/restaurante/criar/localizacao"); return; }
            setRestaurant(data);
            setUserId(session.user.id);
            try {
                const response = await qrTableAuthenticatedFetch(`/api/addons/billing?restaurantId=${encodeURIComponent(data.id)}`);
                if (!response.ok) throw new Error("billing");
                const billing = await response.json();
                if (canceled) return;
                if (!Array.isArray(billing.addons)) throw new Error("billing");
                const active = billing.addons.some((item: { addon?: { product_key: string }; active?: boolean }) =>
                    item.addon?.product_key === "ia_plus" && item.active);
                if (active) { router.replace(panelUrl(data)); return; }
                setEligible(true);
            } catch {
                // A failed eligibility lookup must never block the free onboarding.
            }
            if (!canceled) setLoading(false);
        })().catch(() => { if (!canceled) setLoading(false); });
        return () => { canceled = true; };
    }, [router]);

    const track = (action: "checkout" | "skip" | "paid") => {
        if (userId && restaurant) capturePosthogLightweight("imenu_plus_onboarding_action", userId, {
            action, restaurant_id: restaurant.id, surface: "onboarding_complete",
        });
    };
    const continueToPanel = (action: "skip" | "paid") => {
        track(action);
        router.replace(restaurant ? panelUrl(restaurant) : "/painel");
    };
    const openCheckout = () => { track("checkout"); setCheckout(true); };

    if (loading) return <main className="flex min-h-[50vh] items-center justify-center"><Loader /></main>;

    return <main ref={exposureRef} className="plans-page mx-auto w-full max-w-6xl px-4 pb-40 pt-5 sm:px-6 sm:pt-8">
        <header className="mb-7 max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Etapa 5 · Opcional</p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Seu cardápio está pronto. Agora, venda mais.</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">Dê o próximo passo com marketing automático e inteligência artificial para o seu restaurante.</p>
        </header>
        {eligible && restaurant ? <div className="plans-content" style={{ containerType: "inline-size" }}>
            <IaPlusProductCard active={false} presentation="plans" actionLabel="Ativar iMenu Plus" onLearnMore={openCheckout} />
        </div> : <p className="text-sm text-gray-600">Você já pode continuar para o painel e testar seu cardápio.</p>}
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                {eligible && <p className="text-sm text-gray-600"><strong className="text-xl text-gray-900">{IA_PLUS_PRICE_LABEL}</strong> /mês <span className="ml-2">Cancele quando quiser</span></p>}
                <div className="flex w-full gap-3 sm:ml-auto sm:w-auto">
                    <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => continueToPanel("skip")}>Continuar grátis</Button>
                    {eligible && <Button className="flex-1 sm:flex-none" onClick={openCheckout}>Ativar iMenu Plus</Button>}
                </div>
            </div>
        </footer>
        {restaurant && <IaPlusSalesModal open={checkout} checkout source="onboarding" restaurantId={restaurant.id} onClose={() => setCheckout(false)} onPaid={() => continueToPanel("paid")} />}
    </main>;
}

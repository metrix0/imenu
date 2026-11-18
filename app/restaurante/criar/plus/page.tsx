"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IaPlusProductCard from "@/components/restaurant-owner/ia-vendas/IaPlusProductCard";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import { capturePosthogLightweight } from "@/lib/api/instrumentation-client";
import { usePlusExposure } from "@/lib/analytics/plusExposure";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import "../../../painel/planos/planos.css";

type Restaurant = {
    id: string;
    url_slug: string | null;
    first_time: boolean;
    creation_step: number;
    onboarding_completed_at: string | null;
};
const panelUrl = (slug: string) =>
    `/painel?onboarding=complete&menu=${encodeURIComponent(slug)}`;

export default function OnboardingPlusPage() {
    const router = useRouter();
    const { completeOnboarding, setRestaurantId } = useCreationStore();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [eligible, setEligible] = useState(false);
    const [checkout, setCheckout] = useState(false);
    const [finishing, setFinishing] = useState<"skip" | "continue" | "paid" | null>(null);
    const saving = finishing !== null;
    const [error, setError] = useState("");
    const exposureRef = usePlusExposure("onboarding_complete", eligible && !loading && !checkout);

    const finish = useCallback(async (store: Restaurant) => {
        const response = await fetch(`/api/restaurants/${store.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_time: false, creation_step: 5 }),
        });
        if (!response.ok) throw new Error("Não foi possível concluir o cadastro. Tente novamente.");
        const { url_slug, onboarding_completed_at } = await response.json() as Pick<Restaurant, "url_slug" | "onboarding_completed_at">;
        if (!url_slug) throw new Error("Não foi possível gerar o link do seu cardápio. Tente novamente.");
        completeOnboarding(store.id, url_slug, onboarding_completed_at);
        router.replace(panelUrl(url_slug));
    }, [completeOnboarding, router]);

    useEffect(() => {
        let canceled = false;
        void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (canceled) return;
            if (!session) { router.replace("/restaurante/login"); return; }
            const { data, error: loadError } = await supabase.from("restaurants")
                .select("id,url_slug,first_time,creation_step,onboarding_completed_at").eq("user_id", session.user.id).maybeSingle();
            if (canceled) return;
            if (loadError || !data) throw new Error("Não foi possível carregar seu restaurante. Tente novamente.");
            if (data.first_time === false && data.url_slug) {
                completeOnboarding(data.id, data.url_slug, data.onboarding_completed_at);
                router.replace(panelUrl(data.url_slug));
                return;
            }
            if (data.creation_step !== 5) { router.replace(getCreationStepPath(data.creation_step)); return; }
            setRestaurant(data);
            setRestaurantId(data.id);
            setUserId(session.user.id);
            if (data.first_time === false) {
                await finish(data);
                return;
            }
            let active = false;
            try {
                const response = await qrTableAuthenticatedFetch(`/api/addons/billing?restaurantId=${encodeURIComponent(data.id)}`);
                if (!response.ok) throw new Error("billing");
                const billing = await response.json();
                if (canceled) return;
                if (!Array.isArray(billing.addons)) throw new Error("billing");
                active = billing.addons.some((item: { addon?: { product_key: string }; active?: boolean }) =>
                    item.addon?.product_key === "ia_plus" && item.active);
                setEligible(!active);
            } catch {
                // A failed eligibility lookup must never block the free onboarding.
            }
            if (canceled) return;
            if (active) {
                try { await finish(data); }
                catch (caught) { if (!canceled) setError((caught as Error).message); }
            }
            if (!canceled) setLoading(false);
        })().catch(caught => {
            if (!canceled) { setError((caught as Error).message); setLoading(false); }
        });
        return () => { canceled = true; };
    }, [completeOnboarding, finish, router, setRestaurantId]);

    const track = (action: "checkout" | "skip" | "continue" | "paid" | "back") => {
        if (userId && restaurant) capturePosthogLightweight("imenu_plus_onboarding_action", userId, {
            action, restaurant_id: restaurant.id, surface: "onboarding_complete", step: 5,
        });
    };
    const continueToPanel = async (action: "skip" | "continue" | "paid") => {
        if (!restaurant || saving) return;
        track(action);
        setFinishing(action);
        try { await finish(restaurant); }
        catch (caught) {
            setError((caught as Error).message);
            setFinishing(null);
        }
    };
    const openCheckout = () => { track("checkout"); setCheckout(true); };
    const back = () => { track("back"); router.push("/restaurante/criar/localizacao"); };

    if (loading) return <main className="flex min-h-[50vh] items-center justify-center"><Loader /></main>;

    return <main ref={exposureRef} className="plans-page mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6">
        <header className="mb-7 max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">iMenu Plus · Opcional</p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Seu cardápio está pronto. Agora, venda mais.</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">Dê o próximo passo com marketing automático e inteligência artificial para o seu restaurante.</p>
        </header>
        {eligible && restaurant ? <div className="plans-content" style={{ containerType: "inline-size" }}>
            <IaPlusProductCard active={false} presentation="plans" actionLabel="Ativar iMenu Plus" onLearnMore={openCheckout} />
        </div> : <p className="text-sm text-gray-600">Você já pode continuar para o painel e testar seu cardápio.</p>}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="mx-auto flex max-w-4xl items-center justify-between">
                <button type="button" onClick={back} disabled={saving} className="cursor-pointer text-[13px] font-medium text-brand disabled:opacity-50">Voltar</button>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => void continueToPanel("skip")} disabled={saving || !restaurant} className="cursor-pointer text-[13px] font-medium text-gray-500 transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-50">{finishing === "skip" ? "Pulando..." : "Pular"}</button>
                    <Button onClick={() => void continueToPanel("continue")} loading={finishing === "continue" || finishing === "paid"} disabled={saving || !restaurant} className="px-8">Continuar</Button>
                </div>
            </div>
        </div>
        {restaurant && <IaPlusSalesModal open={checkout} checkout source="onboarding" restaurantId={restaurant.id} onClose={() => setCheckout(false)} onPaid={() => continueToPanel("paid")} />}
        {error && <Toast message={error} type="error" onClose={() => setError("")} />}
    </main>;
}

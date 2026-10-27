"use client";

import { useEffect } from "react";
import MenuProductCards from "@/components/restaurant-owner/mesas/MenuProductCards";
import Button from "@/components/ui/Button";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";

export default function QrTableOnboardingSelection({ restaurantId, onContinue }: {
    restaurantId: string;
    onContinue: () => void;
}) {
    useEffect(() => {
        void captureQrTableEvent("qr_code_mesa_onboarding_viewed", { restaurant_id: restaurantId });
    }, [restaurantId]);
    return (
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-10">
            <div className="mx-auto max-w-3xl text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Antes de começar</p>
                <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Conheça os recursos do iMenu</h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
                    Cardápio Digital e QR Code nas mesas são gratuitos, para sempre e sem limites.
                    Crie seu cardápio em <strong className="font-bold text-gray-900">menos de 5 minutos</strong> com IA.
                </p>
            </div>
            <div className="mt-9">
                <MenuProductCards qrSelected qrActive onLearnMore={() => {}} />
            </div>
            <div className="mt-8 flex justify-end">
                <Button type="button" className="w-full px-8 py-3 sm:w-auto" onClick={onContinue}>Continuar</Button>
            </div>
        </main>
    );
}

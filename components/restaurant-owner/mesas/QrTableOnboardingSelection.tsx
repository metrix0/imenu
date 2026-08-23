"use client";

import { useEffect, useState } from "react";

import MenuProductCards from "@/components/restaurant-owner/mesas/MenuProductCards";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import { startQrTableCheckout } from "@/lib/qr-table/clientApi";

export default function QrTableOnboardingSelection({
    restaurantId,
    onContinue,
}: {
    restaurantId: string;
    onContinue: () => void;
}) {
    const [qrSelected, setQrSelected] = useState(false);
    const [salesOpen, setSalesOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        void captureQrTableEvent("qr_code_mesa_onboarding_viewed", {
            restaurant_id: restaurantId,
        });
    }, [restaurantId]);

    const openSales = () => {
        setSalesOpen(true);
        void captureQrTableEvent("qr_code_mesa_learn_more_viewed", {
            restaurant_id: restaurantId,
            source: "onboarding",
        });
    };

    const completeSelection = async (selectQr = qrSelected) => {
        if (submitting) return;
        setSubmitting(true);

        try {
            if (selectQr) {
                setQrSelected(true);
                void captureQrTableEvent("qr_code_mesa_onboarding_selected", {
                    restaurant_id: restaurantId,
                });
                void captureQrTableEvent("qr_code_mesa_purchase_started", {
                    restaurant_id: restaurantId,
                    source: "onboarding",
                });
                await startQrTableCheckout(restaurantId, "onboarding");
            }

            onContinue();
        } catch (error) {
            setSubmitting(false);
            setToast(
                error instanceof Error
                    ? error.message
                    : "Não foi possível continuar."
            );
        }
    };

    return (
        <>
            {toast && (
                <Toast
                    message={toast}
                    type="error"
                    onClose={() => setToast(null)}
                />
            )}

            <QrCodeMesaSalesModal
                open={salesOpen}
                onClose={() => setSalesOpen(false)}
                onBuy={() => void completeSelection(true)}
                buying={submitting}
            />

            <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 sm:pt-10">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                        Antes de começar
                    </p>
                    <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
                        Escolha os produtos do seu iMenu
                    </h1>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
                        O Cardápio Digital já está incluído. Adicione o QR Code
                        Mesa para receber pedidos identificados diretamente das
                        mesas do seu estabelecimento.
                    </p>
                </div>

                <div className="mt-9">
                    <MenuProductCards
                        qrSelected={qrSelected}
                        onQrToggle={() =>
                            setQrSelected((selected) => !selected)
                        }
                        onLearnMore={openSales}
                    />
                </div>

                <div className="mt-8 flex justify-end">
                    <Button
                        type="button"
                        loading={submitting}
                        className="w-full px-8 py-3 sm:w-auto"
                        onClick={() => void completeSelection()}
                    >
                        {qrSelected
                            ? "Continuar para pagamento"
                            : "Continuar"}
                    </Button>
                </div>
            </main>
        </>
    );
}

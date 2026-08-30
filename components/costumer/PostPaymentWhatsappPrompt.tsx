"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function PostPaymentWhatsappPrompt({
    orderId,
}: {
    orderId: string;
}) {
    const [open, setOpen] = useState(false);
    const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let finished = false;

        const checkPayment = async () => {
            if (!active || finished) return;

            try {
                const orderResponse = await fetch(`/api/orders/${orderId}`, {
                    cache: "no-store",
                });
                if (!orderResponse.ok) return;

                const order = await orderResponse.json();
                const paymentMethod = String(
                    order?.payment_method ?? order?.paymentMethod ?? "",
                );
                const status = String(order?.status ?? "");

                if (paymentMethod !== "pix" || status === "canceled") {
                    finished = true;
                    return;
                }

                if (status !== "paid") return;

                const confirmationResponse = await fetch(
                    `/api/orders/${orderId}/whatsapp-confirmation`,
                    { cache: "no-store" },
                );
                if (!confirmationResponse.ok) return;

                const confirmation = await confirmationResponse.json();
                if (confirmation?.enabled !== true) {
                    finished = true;
                    return;
                }

                if (!confirmation?.url) return;

                finished = true;
                if (!active) return;

                setWhatsappUrl(confirmation.url);
                setOpen(true);
            } catch (error) {
                console.error(
                    "[POST_PAYMENT_WHATSAPP] Failed to prepare prompt:",
                    error,
                );
            }
        };

        void checkPayment();
        const interval = window.setInterval(() => {
            void checkPayment();
        }, 2500);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [orderId]);

    const openWhatsapp = () => {
        if (!whatsappUrl) return;

        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        setOpen(false);
    };

    return (
        <Modal open={open} onClose={() => {}} className="max-w-md">
            <div className="px-6 pb-6 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-2xl" />
                </div>

                <h2 className="mt-5 text-2xl font-bold text-gray-900">
                    Pagamento confirmado!
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
                    Seu Pix foi aprovado. Ainda falta um passo para finalizar:
                    envie a comanda ao restaurante pelo WhatsApp.
                </p>

                <Button
                    type="button"
                    variant="primary"
                    onClick={openWhatsapp}
                    className="mt-6 w-full py-3"
                >
                    Enviar comanda no WhatsApp
                </Button>
            </div>
        </Modal>
    );
}

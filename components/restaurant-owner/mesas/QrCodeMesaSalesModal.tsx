"use client";

import { useState } from "react";
import Image from "next/image";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faBellConcierge, faQrcode, faUsers } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import type { QrTableSource } from "@/lib/qr-table/types";

const BENEFITS = [
    { icon: faQrcode, title: "Mesas ilimitadas", description: "Crie mesas e QR Codes ilimitados gratuitamente." },
    { icon: faBellConcierge, title: "Painel do Garçom", description: "Acompanhe e registre pedidos de cada mesa." },
    { icon: faUsers, title: "Acompanhamento de pedidos", description: "O cliente acompanha os pedidos pelo próprio cardápio." },
] as const;

export default function QrCodeMesaSalesModal({
    open, onClose, restaurantId, source, active = false, onPaid,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    source: QrTableSource;
    active?: boolean;
    onPaid?: () => void | Promise<void>;
}) {
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState("");
    const activate = async () => {
        if (activating) return;
        setActivating(true);
        setError("");
        try {
            const response = await qrTableAuthenticatedFetch("/api/qr-table/activate", {
                method: "POST", body: JSON.stringify({ restaurantId, source }),
            });
            if (!response.ok) {
                const payload = (await response.json()) as { error?: string };
                throw new Error(payload.error || "Não foi possível ativar o QR Code.");
            }
            await onPaid?.();
            onClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível ativar o QR Code.");
        } finally {
            setActivating(false);
        }
    };

    return <Modal fixedHeight height={640} open={open} onClose={onClose} className="max-w-4xl" showCloseButton bodyClassName="flex flex-col !overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            <div className="relative h-12 w-56 max-w-full">
                <Image src="/logos/QRCODECombinationMarkLogo_Brand.png" alt="iMenu QR Code Mesa" fill sizes="224px" className="object-contain object-left" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-brand">Pedidos direto pela mesa</p>
            <h2 className="mt-3 text-2xl font-bold text-gray-900">iMenu QR Code Mesa</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">Receba pedidos identificados por mesa, direto no painel e na impressão. Gratuito para todos os restaurantes.</p>
            <p className="mt-5 inline-flex rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-lg font-bold text-brand">Grátis para sempre, sem limites</p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
                {BENEFITS.map((benefit) => (
                    <div key={benefit.title} className="rounded-xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/70 p-4">
                        <FontAwesomeIcon icon={benefit.icon} className="text-lg text-brand" />
                        <h3 className="mt-3 font-semibold text-gray-900">{benefit.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500">{benefit.description}</p>
                    </div>
                ))}
            </div>
            {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:px-8">
            <a href="https://wa.me/5519997235394?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20iMenu%20QR%20Code%20Mesa." target="_blank" rel="noopener noreferrer" className="mr-auto hidden items-center gap-2 text-sm text-gray-600 hover:text-brand sm:inline-flex"><FontAwesomeIcon icon={faWhatsapp} /> Fale conosco</a>
            <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
            {!active && <Button type="button" onClick={() => void activate()} loading={activating}>Ativar gratuitamente</Button>}
        </div>
    </Modal>;
}

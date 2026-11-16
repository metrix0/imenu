"use client";

import ConfirmModal from "@/components/ui/ConfirmModal";
import { formatCurrencyFromCents } from "@/lib/dev/dashboardFormat";

type PayoutRetryDialogProps = {
    payout?: { amount_cents: number; restaurant_name: string };
    warnAboutLaterPayout?: boolean;
    busy: boolean;
    onClose: () => void;
    onConfirm: (confirmedLaterPayout: boolean) => void;
};

export default function PayoutRetryDialog({
    payout,
    warnAboutLaterPayout = false,
    busy,
    onClose,
    onConfirm,
}: PayoutRetryDialogProps) {
    if (!payout) return null;

    const amount = formatCurrencyFromCents(payout.amount_cents);
    const destination = `${amount} para ${payout.restaurant_name}`;

    return (
        <ConfirmModal
            key={warnAboutLaterPayout ? "warning" : "confirmation"}
            open
            onClose={() => { if (!busy) onClose(); }}
            onConfirm={() => onConfirm(warnAboutLaterPayout)}
            isLoading={busy}
            variant={warnAboutLaterPayout ? "danger" : "primary"}
            title={warnAboutLaterPayout ? "Já existe um repasse mais recente" : "Confirmar reenvio do Pix"}
            description={warnAboutLaterPayout
                ? `Confira no histórico se os pedidos já foram pagos no repasse mais recente. Confirma o reenvio de ${destination}?`
                : `Reenviar ${destination} usando os dados Pix atuais da loja?`}
            confirmLabel={warnAboutLaterPayout ? "Reenviar mesmo assim" : "Confirmar reenvio"}
        />
    );
}

"use client";

import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faPix } from "@fortawesome/free-brands-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import Card from "@/components/ui/Card";
import RecommendedBadge from "@/components/ui/RecommendedBadge";
import ToggleOptionCard from "@/components/ui/ToggleOptionCard";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useState } from "react";

export const DEFAULT_ALLOWED_PAYMENT_METHODS = [
    "pix",
    "dinheiro",
    "trazer-maquininha",
];

const PAYMENT_OPTIONS = [
    { value: "pix", label: "Pix (Online)", icon: faPix, recommended: true },
    { value: "pix-entrega", label: "Pix (Na entrega)", icon: faPix },
    { value: "dinheiro", label: "Dinheiro", icon: icons.faMoneyBill },
    {
        value: "trazer-maquininha",
        label: "Maquininha",
        icon: icons.faPersonBiking,
    },
];

type Props = {
    value: string[];
    onChange: (value: string[]) => void;
    className?: string;
};

export default function AllowedPaymentMethods({
    value,
    onChange,
    className = "",
}: Props) {
    const [confirmPixDisableOpen, setConfirmPixDisableOpen] = useState(false);
    const selected =
        Array.isArray(value) && value.length
            ? value
            : DEFAULT_ALLOWED_PAYMENT_METHODS;

    const toggle = (method: string) => {
        if (method === "pix" && selected.includes("pix")) {
            setConfirmPixDisableOpen(true);
            return;
        }

        const next = selected.includes(method)
            ? selected.filter((value) => value !== method)
            : [...selected, method];
        if (next.length) onChange(next);
    };

    const disablePix = () => {
        const next = selected.filter((value) => value !== "pix");
        if (next.length) onChange(next);
        setConfirmPixDisableOpen(false);
    };

    return (
        <Card className={`w-full ${className}`}>
            <h2 className="mb-2 text-xl font-semibold">
                Formas de pagamento para clientes
            </h2>
            <p className="mb-5 text-sm text-gray-500">
                Escolha quais formas aparecem para o cliente no checkout.{" "}
                <strong>Pagamentos com Pix (Online) são repassados</strong>{" "}
                dentro de 1 dia (todo dia às 12:00).
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((option) => {
                    const active = selected.includes(option.value);

                    return (
                        <ToggleOptionCard
                            key={option.value}
                            label={option.label}
                            checked={active}
                            onChange={() => toggle(option.value)}
                            icon={<FontAwesomeIcon icon={option.icon} />}
                            badge={
                                option.recommended ? (
                                    <RecommendedBadge infoText="Pagamentos são confirmados automaticamente e 34% dos usuários preferem pagar com Pix." />
                                ) : undefined
                            }
                        />
                    );
                })}
            </div>

            <ConfirmModal
                open={confirmPixDisableOpen}
                onClose={() => setConfirmPixDisableOpen(false)}
                onConfirm={disablePix}
                title="Desativar Pix Online?"
                description="Os pagamentos com Pix Online são confirmados automaticamente e 34% dos usuários preferem pagar com Pix. Tem certeza de que deseja desativá-lo?"
                confirmLabel="Desativar Pix Online"
                cancelLabel="Manter ativado"
            />
        </Card>
    );
}

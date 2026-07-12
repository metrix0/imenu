"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPix } from "@fortawesome/free-brands-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import ToggleInput from "@/components/ui/ToggleInput";

export const DEFAULT_ALLOWED_PAYMENT_METHODS = [
    "pix",
    "dinheiro",
    "trazer-maquininha",
];

const PAYMENT_OPTIONS = [
    {
        value: "pix",
        label: "Pix (Online)",
        icon: faPix,
    },
    {
        value: "pix-entrega",
        label: "Pix (Na entrega)",
        icon: faPix,
    },
    {
        value: "dinheiro",
        label: "Dinheiro",
        icon: icons.faMoneyBill,
    },
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
    const selected =
        Array.isArray(value) && value.length > 0
            ? value
            : DEFAULT_ALLOWED_PAYMENT_METHODS;

    const toggle = (method: string) => {
        const next = selected.includes(method)
            ? selected.filter((current) => current !== method)
            : [...selected, method];

        if (next.length === 0) return;
        onChange(next);
    };

    return (
        <div
            className={`p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8 ${className}`}
        >
            <h2 className="text-xl font-semibold mb-2">
                Formas de pagamento para clientes
            </h2>

            <p className="text-sm text-gray-500 mb-5">
                Escolha quais formas de pagamento aparecem para o cliente no
                checkout.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 gap-x-12">
                {PAYMENT_OPTIONS.map((option) => {
                    const active = selected.includes(option.value);

                    return (
                        <div
                            key={option.value}
                            className={`border rounded-xl p-4 flex items-center justify-between gap-4 duration-200 ${
                                active
                                    ? "border-gray-200 bg-brand/5"
                                    : "border-gray-200 bg-white"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon
                                    icon={option.icon}
                                    className={
                                        active
                                            ? "text-brand"
                                            : "text-gray-500"
                                    }
                                />

                                <span className="font-medium text-gray-800">
                                    {option.label}
                                </span>
                            </div>

                            <ToggleInput
                                checked={active}
                                onChange={() => toggle(option.value)}
                                color="bg-green-500"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

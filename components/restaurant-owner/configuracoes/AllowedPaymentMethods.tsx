"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPix } from "@fortawesome/free-brands-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import ToggleInput from "@/components/ui/ToggleInput";

export const DEFAULT_ALLOWED_PAYMENT_METHODS = ["pix", "dinheiro", "trazer-maquininha"];
const PAYMENT_OPTIONS = [
    { value: "pix", label: "Pix (Online)", icon: faPix, recommended: true },
    { value: "pix-entrega", label: "Pix (Na entrega)", icon: faPix },
    { value: "dinheiro", label: "Dinheiro", icon: icons.faMoneyBill },
    { value: "trazer-maquininha", label: "Maquininha", icon: icons.faPersonBiking },
];

type Props = { value: string[]; onChange: (value: string[]) => void; className?: string };
export default function AllowedPaymentMethods({ value, onChange, className = "" }: Props) {
    const selected = Array.isArray(value) && value.length ? value : DEFAULT_ALLOWED_PAYMENT_METHODS;
    const toggle = (method: string) => {
        const next = selected.includes(method) ? selected.filter((v) => v !== method) : [...selected, method];
        if (next.length) onChange(next);
    };
    return (
        <div className={`w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
            <h2 className="mb-2 text-xl font-semibold">Formas de pagamento para clientes</h2>
            <p className="mb-5 text-sm text-gray-500">Escolha quais formas aparecem para o cliente no checkout.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-12">
                {PAYMENT_OPTIONS.map((option) => {
                    const active = selected.includes(option.value);
                    return (
                        <div key={option.value} className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${active ? "border-gray-200 bg-brand/5" : "border-gray-200 bg-white"}`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <FontAwesomeIcon icon={option.icon} className={active ? "text-brand" : "text-gray-500"} />
                                <span className="min-w-0 font-medium text-gray-800">{option.label}{option.recommended && <span className="ml-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-brand">★ Recomendado</span>}</span>
                            </div>
                            <ToggleInput checked={active} onChange={() => toggle(option.value)} color="bg-green-500" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

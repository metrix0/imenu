"use client";

import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Tooltip from "@/components/ui/Tooltip";

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

const PIX_KEY_TYPE_OPTIONS = [
    { value: "", label: "Definir tipo de chave" },
    { value: "AUTO", label: "Detectar automaticamente" },
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Telefone" },
    { value: "EVP", label: "Chave aleatória" },
];

export function inferPixKeyType(value: string): PixKeyType | null {
    const raw = value.trim();
    if (!raw) return null;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return "EVP";
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "EMAIL";
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(raw)) return "CNPJ";
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) return "CPF";
    if (/^\+55\D*\d{2}\D*\d{8,9}$/.test(raw) || /^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(raw)) {
        return "PHONE";
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 14) return "CNPJ";
    if (digits.length === 13 && digits.startsWith("55")) return "PHONE";
    return null;
}

type PixPayoutFieldsProps = {
    paymentInfo: string;
    paymentInfoType: string;
    onPaymentInfoChange: (value: string) => void;
    onPaymentInfoTypeChange: (value: string) => void;
    onSave: (fields: Record<string, unknown>) => Promise<unknown> | unknown;
};

export default function PixPayoutFields({
    paymentInfo,
    paymentInfoType,
    onPaymentInfoChange,
    onPaymentInfoTypeChange,
    onSave,
}: PixPayoutFieldsProps) {
    const needsPixType = Boolean(paymentInfo.trim() && !paymentInfoType);

    const handlePaymentInfoBlur = async () => {
        if (paymentInfoType === "AUTO" && paymentInfo.trim()) {
            const detectedType = inferPixKeyType(paymentInfo);
            if (detectedType) {
                onPaymentInfoTypeChange(detectedType);
                await onSave({
                    payment_info: paymentInfo,
                    payment_info_type: detectedType,
                });
                return;
            }

            onPaymentInfoTypeChange("");
            await onSave({
                payment_info: paymentInfo,
                payment_info_type: null,
            });
            return;
        }

        await onSave({ payment_info: paymentInfo });
    };

    const handlePaymentInfoTypeChange = (nextType: string) => {
        if (nextType === "AUTO" && paymentInfo.trim()) {
            const detectedType = inferPixKeyType(paymentInfo);
            if (detectedType) {
                onPaymentInfoTypeChange(detectedType);
                void onSave({ payment_info_type: detectedType });
            } else {
                onPaymentInfoTypeChange("");
                void onSave({ payment_info_type: null });
            }
            return;
        }

        onPaymentInfoTypeChange(nextType);
        void onSave({
            payment_info_type:
                nextType === "AUTO" || !nextType ? null : nextType,
        });
    };

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div data-ui="field" className="min-w-0">
                <div
                    data-ui="field-label"
                    className="text-xs font-medium leading-[18px]"
                >
                    Tipo da chave PIX
                </div>
                <Dropdown
                    aria-label="Tipo da chave PIX"
                    options={PIX_KEY_TYPE_OPTIONS}
                    value={paymentInfoType}
                    onChange={(event) =>
                        handlePaymentInfoTypeChange(event.target.value)
                    }
                />
            </div>

            <div data-ui="field" className="min-w-0">
                <div
                    data-ui="field-label"
                    className={`flex items-center gap-1.5 text-xs font-medium leading-[18px] ${
                        needsPixType ? "text-red-600" : ""
                    }`}
                >
                    <span>Chave Pix para Repasses diários às 12:00</span>
                    <Tooltip
                        text="Esta chave é usada somente para os repasses de pagamentos feitos via Pix Online. Os repasses são processados diariamente às 12:00."
                        size="medium"
                        showOnClick
                        parentClassName="shrink-0 leading-none"
                    >
                        <button
                            type="button"
                            aria-label="Mais informações sobre os repasses Pix"
                            className="inline-flex h-4 w-4 items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
                        >
                            <FontAwesomeIcon
                                icon={faCircleInfo}
                                className="text-[13px]"
                            />
                        </button>
                    </Tooltip>
                </div>
                <Input
                    placeholder="Ex: 123456789"
                    value={paymentInfo}
                    onChange={(event) =>
                        onPaymentInfoChange(event.target.value)
                    }
                    onBlur={() => void handlePaymentInfoBlur()}
                    className={
                        needsPixType
                            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                            : ""
                    }
                />
                {needsPixType && (
                    <p className="text-xs font-medium text-red-600">
                        Defina o tipo da chave PIX acima.
                    </p>
                )}
            </div>
        </div>
    );
}

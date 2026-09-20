"use client";

import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCreditCard } from "@fortawesome/free-solid-svg-icons";
import { faPix } from "@fortawesome/free-brands-svg-icons";

import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";
import Input from "@/components/ui/Input";
import type {
    CreditCardPaymentData,
    OnlinePaymentMethod,
} from "@/lib/payments/types";

type PaymentFormProps = {
    method: OnlinePaymentMethod;
    card: CreditCardPaymentData;
    onMethodChange: (method: OnlinePaymentMethod) => void;
    onCardChange: (card: CreditCardPaymentData) => void;
    disabled?: boolean;
    error?: string | null;
    pixDescription?: string;
    cardDescription?: string;
};

function formatCardNumber(value: string): string {
    return value
        .replace(/\D/g, "")
        .slice(0, 19)
        .replace(/(.{4})/g, "$1 ")
        .trim();
}

function formatExpiration(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCpfCnpj(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
        return digits
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }
    return digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPostalCode(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    return digits.length > 5
        ? `${digits.slice(0, 5)}-${digits.slice(5)}`
        : digits;
}

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PaymentForm({
    method,
    card,
    onMethodChange,
    onCardChange,
    disabled = false,
    error,
    pixDescription = "Pagamento via Pix",
    cardDescription = "Pagamento com cartão de crédito",
}: PaymentFormProps) {
    const updateCard = (
        field: keyof CreditCardPaymentData,
        value: string
    ) => {
        onCardChange({ ...card, [field]: value });
    };
    const cardDisabled = disabled || method !== "credit_card";

    return (
        <div>
            <ChoiceCardGroup
                value={method}
                disabled={disabled}
                aria-label="Forma de pagamento"
                className="sm:grid-cols-2"
                onChange={onMethodChange}
                options={[
                    {
                        value: "pix",
                        label: (
                            <span className="inline-flex items-center gap-2">
                                <FontAwesomeIcon icon={faPix} />
                                Pix
                            </span>
                        ),
                        description: pixDescription,
                    },
                    {
                        value: "credit_card",
                        label: (
                            <span className="inline-flex items-center gap-2">
                                <FontAwesomeIcon icon={faCreditCard} />
                                Cartão de crédito
                            </span>
                        ),
                        description: cardDescription,
                    },
                ]}
            />

            <div
                aria-hidden={method !== "credit_card"}
                className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                    method === "credit_card"
                        ? "mt-5 grid-rows-[1fr] opacity-100"
                        : "mt-0 grid-rows-[0fr] opacity-0"
                }`}
            >
                <div className="min-h-0 overflow-hidden">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Input
                            label="Número do cartão"
                            value={card.number}
                            inputMode="numeric"
                            autoComplete="cc-number"
                            disabled={cardDisabled}
                            onChange={(event) =>
                                updateCard(
                                    "number",
                                    formatCardNumber(event.target.value)
                                )
                            }
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Input
                            label="Nome no cartão"
                            value={card.holderName}
                            autoComplete="cc-name"
                            disabled={cardDisabled}
                            onChange={(event) =>
                                updateCard(
                                    "holderName",
                                    event.target.value.toUpperCase()
                                )
                            }
                        />
                    </div>
                    <Input
                        label="Validade"
                        placeholder="MM/AA"
                        value={card.expiry}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard(
                                "expiry",
                                formatExpiration(event.target.value)
                            )
                        }
                    />
                    <Input
                        label="CVV"
                        value={card.ccv}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        maxLength={4}
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard(
                                "ccv",
                                event.target.value.replace(/\D/g, "")
                            )
                        }
                    />
                    <Input
                        label="CPF/CNPJ do titular"
                        value={card.cpfCnpj}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard(
                                "cpfCnpj",
                                formatCpfCnpj(event.target.value)
                            )
                        }
                    />
                    <Input
                        label="Celular"
                        value={card.mobilePhone}
                        inputMode="tel"
                        autoComplete="tel"
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard(
                                "mobilePhone",
                                formatPhone(event.target.value)
                            )
                        }
                    />
                    <div className="sm:col-span-2">
                        <Input
                            label="E-mail"
                            type="email"
                            value={card.email}
                            autoComplete="email"
                            disabled={cardDisabled}
                            onChange={(event) =>
                                updateCard("email", event.target.value)
                            }
                        />
                    </div>
                    <Input
                        label="CEP"
                        value={card.postalCode}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard(
                                "postalCode",
                                formatPostalCode(event.target.value)
                            )
                        }
                    />
                    <Input
                        label="Número"
                        value={card.addressNumber}
                        autoComplete="address-line2"
                        disabled={cardDisabled}
                        onChange={(event) =>
                            updateCard("addressNumber", event.target.value)
                        }
                    />
                    <div className="sm:col-span-2">
                        <Input
                            label="Complemento (opcional)"
                            value={card.addressComplement ?? ""}
                            autoComplete="off"
                            disabled={cardDisabled}
                            onChange={(event) =>
                                updateCard(
                                    "addressComplement",
                                    event.target.value
                                )
                            }
                        />
                    </div>
                </div>
                </div>
            </div>

            {error && (
                <p className="mt-5 rounded-[8px] bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}

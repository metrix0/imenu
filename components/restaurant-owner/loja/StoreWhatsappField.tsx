"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Input from "@/components/ui/Input";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import { useAutoSave } from "@/lib/utils/useAutoSave";

function formatPhone(value: string, field: PhoneField): string {
    let digits = value.replace(/\D/g, "");
    if (field === "store_whatsapp" && digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type Props = {
    restaurantId: string;
    initialValue: string | null;
    onSaveStatusChange?: (status: SaveState) => void;
};

type PhoneField = "store_whatsapp" | "phone";

const phoneFields = {
    store_whatsapp: {
        label: "WhatsApp da loja",
        invalidMessage: "Informe o DDD e o número do WhatsApp.",
        saveError: "Não foi possível salvar o WhatsApp da loja.",
    },
    phone: {
        label: "Celular do responsável",
        invalidMessage: "Informe o DDD e o celular do responsável.",
        saveError: "Não foi possível salvar o celular do responsável.",
    },
};

function RestaurantPhoneField({ restaurantId, initialValue, onSaveStatusChange, field }: Props & { field: PhoneField }) {
    const feedbackId = useId();
    const { label, invalidMessage, saveError } = phoneFields[field];
    const [value, setValue] = useState(() => formatPhone(initialValue || "", field));
    const [invalid, setInvalid] = useState(false);
    const [showInvalid, setShowInvalid] = useState(false);
    const save = useCallback(async (digits: string) => {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: digits }),
        });
        if (!response.ok) throw new Error(saveError);
    }, [field, restaurantId, saveError]);
    const { error, status, schedule, reset } = useAutoSave(restaurantId, save);

    useEffect(() => {
        onSaveStatusChange?.(status);
    }, [onSaveStatusChange, status]);

    const changeValue = (rawValue: string) => {
        const formatted = formatPhone(rawValue, field);
        if (formatted === value) return;
        const digits = formatted.replace(/\D/g, "");
        setValue(formatted);
        const isInvalid = field === "phone" ? digits.length !== 11 : digits.length > 0 && digits.length < 10;
        setInvalid(isInvalid);
        if (isInvalid) {
            reset("error");
        } else {
            setShowInvalid(false);
            schedule(digits);
        }
    };

    const feedback = showInvalid ? invalidMessage : error;

    return (
        <div className="min-w-0">
            <Input
                label={label}
                placeholder="(00) 00000-0000"
                type="tel"
                inputMode="tel"
                value={value}
                onChange={(event) => changeValue(event.target.value)}
                onBlur={() => setShowInvalid(invalid)}
                maxLength={15}
                autoComplete="tel"
                aria-invalid={showInvalid || undefined}
                aria-describedby={feedback ? feedbackId : undefined}
            />
            {feedback && <p id={feedbackId} className="mt-1 text-sm text-red-600">{feedback}</p>}
            {!onSaveStatusChange && <SaveStatus status={status} />}
        </div>
    );
}

export function ResponsiblePhoneField(props: Props) {
    return <RestaurantPhoneField {...props} field="phone" />;
}

export default function StoreWhatsappField(props: Props) {
    return <RestaurantPhoneField {...props} field="store_whatsapp" />;
}

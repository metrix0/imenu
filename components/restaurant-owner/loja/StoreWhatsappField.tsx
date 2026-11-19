"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Input from "@/components/ui/Input";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import { useAutoSave } from "@/lib/utils/useAutoSave";

function formatPhone(value: string): string {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
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

export default function StoreWhatsappField({ restaurantId, initialValue, onSaveStatusChange }: Props) {
    const feedbackId = useId();
    const [value, setValue] = useState(() => formatPhone(initialValue || ""));
    const [invalid, setInvalid] = useState(false);
    const [showInvalid, setShowInvalid] = useState(false);
    const save = useCallback(async (digits: string) => {
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ store_whatsapp: digits }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar o WhatsApp da loja.");
    }, [restaurantId]);
    const { error, status, schedule, reset } = useAutoSave(restaurantId, save);

    useEffect(() => {
        onSaveStatusChange?.(status);
    }, [onSaveStatusChange, status]);

    const changeValue = (rawValue: string) => {
        const formatted = formatPhone(rawValue);
        if (formatted === value) return;
        const digits = formatted.replace(/\D/g, "");
        setValue(formatted);
        const isInvalid = digits.length > 0 && digits.length < 10;
        setInvalid(isInvalid);
        if (isInvalid) {
            reset("error");
        } else {
            setShowInvalid(false);
            schedule(digits);
        }
    };

    const feedback = showInvalid ? "Informe o DDD e o número do WhatsApp." : error;

    return (
        <div className="min-w-0">
            <Input
                label="WhatsApp da loja"
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

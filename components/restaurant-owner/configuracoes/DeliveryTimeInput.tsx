"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import ConfirmModal from "@/components/ui/ConfirmModal";

const MAX_DELIVERY_MINUTES = 14_400;
const CONFIRM_AFTER_MINUTES = 200;

function formatDuration(minutes: number) {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remainder = minutes % 60;
    return [
        days > 0 ? `${days} ${days === 1 ? "dia" : "dias"}` : "",
        hours > 0 ? `${hours} ${hours === 1 ? "hora" : "horas"}` : "",
        remainder > 0 ? `${remainder} ${remainder === 1 ? "minuto" : "minutos"}` : "",
    ].filter(Boolean).join(" e ");
}

type Props = {
    value: number;
    onCommit: (minutes: number) => void;
    label?: string;
    className?: string;
};

export default function DeliveryTimeInput({ value, onCommit, label, className }: Props) {
    const [draft, setDraft] = useState<string | null>(null);
    const [pending, setPending] = useState<number | null>(null);

    const cancel = () => {
        setDraft(null);
        setPending(null);
    };

    const commit = (minutes: number) => {
        cancel();
        if (minutes !== value) onCommit(minutes);
    };

    return (
        <>
            <Input
                label={label}
                aria-label={label ?? "Tempo"}
                className={className}
                numeric
                icon="min"
                iconPosition="right"
                value={draft ?? String(value)}
                onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    setDraft(digits === "" ? "" : String(Math.min(Number(digits), MAX_DELIVERY_MINUTES)));
                }}
                onBlur={() => {
                    if (draft === null || pending !== null) return;
                    const minutes = Math.max(1, Math.min(Number(draft), MAX_DELIVERY_MINUTES));
                    if (minutes !== value && minutes > CONFIRM_AFTER_MINUTES) {
                        setDraft(String(minutes));
                        setPending(minutes);
                    } else {
                        commit(minutes);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                }}
            />
            {pending !== null && (
                <ConfirmModal
                    open
                    variant="primary"
                    title="Confirmar tempo de entrega"
                    description={`Tem certeza de que o tempo de entrega é de ${pending.toLocaleString("pt-BR")} minutos (${formatDuration(pending)})?`}
                    cancelLabel="Revisar"
                    confirmLabel="Confirmar"
                    onClose={cancel}
                    onConfirm={() => commit(pending)}
                />
            )}
        </>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Toast from "@/components/ui/Toast";

interface PreparationTimeCardProps {
    restaurantId: string;
    initialMin?: number | null;
    initialMax?: number | null;
}

function getValidationMessage(minimum: string, maximum: string): string {
    const min = Number(minimum);
    const max = Number(maximum);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) {
        return "Informe tempos válidos maiores que zero.";
    }

    if (max < min + 20) {
        return "O tempo máximo deve ser pelo menos 20 minutos maior que o mínimo.";
    }

    return "";
}

export default function PreparationTimeCard({
    restaurantId,
    initialMin,
    initialMax,
}: PreparationTimeCardProps) {
    const initialMinimum = String(initialMin ?? 40);
    const initialMaximum = String(initialMax ?? 50);
    const [minimum, setMinimum] = useState(initialMinimum);
    const [maximum, setMaximum] = useState(initialMaximum);
    const [saving, setSaving] = useState(false);
    const [validationMessage, setValidationMessage] = useState(() =>
        getValidationMessage(initialMinimum, initialMaximum)
    );
    const [toast, setToast] = useState<{
        message: string;
        type: "error";
    } | null>(null);
    const lastSavedRef = useRef(
        `${Number(initialMinimum)}:${Number(initialMaximum)}`
    );
    const saveVersionRef = useRef(0);

    useEffect(() => {
        const validation = getValidationMessage(minimum, maximum);
        setValidationMessage(validation);

        if (validation) {
            setSaving(false);
            return;
        }

        const min = Number(minimum);
        const max = Number(maximum);
        const valueKey = `${min}:${max}`;

        if (valueKey === lastSavedRef.current) {
            setSaving(false);
            return;
        }

        const version = saveVersionRef.current + 1;
        saveVersionRef.current = version;
        setSaving(true);

        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/restaurants/${restaurantId}/set-prep-time`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ min, max, source: "manual" }),
                    }
                );

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload?.error || "Erro ao salvar o tempo.");
                }

                lastSavedRef.current = valueKey;
            } catch (error) {
                setToast({
                    message:
                        error instanceof Error
                            ? error.message
                            : "Erro ao salvar o tempo.",
                    type: "error",
                });
            } finally {
                if (saveVersionRef.current === version) {
                    setSaving(false);
                }
            }
        }, 700);

        return () => window.clearTimeout(timeoutId);
    }, [maximum, minimum, restaurantId]);

    return (
        <>
            <Card className="border border-gray-200 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold">
                        Tempo médio de preparo
                    </h2>
                    <span
                        className={`shrink-0 text-sm font-medium ${
                            validationMessage
                                ? "text-red-600"
                                : saving
                                  ? "animate-pulse text-brand"
                                  : "text-green-600"
                        }`}
                    >
                        {validationMessage
                            ? "Não salvo"
                            : saving
                              ? "Salvando..."
                              : "Tudo salvo"}
                    </span>
                </div>

                <p className="mb-5 text-sm text-gray-500">
                    Defina a estimativa exibida aos clientes. As alterações são
                    salvas automaticamente.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Mínimo (min)"
                        value={minimum}
                        onChange={(event) => setMinimum(event.target.value)}
                        numeric
                    />
                    <Input
                        label="Máximo (min)"
                        value={maximum}
                        onChange={(event) => setMaximum(event.target.value)}
                        numeric
                    />
                </div>

                <p
                    className={`mt-2 text-xs ${
                        validationMessage ? "text-red-600" : "text-gray-500"
                    }`}
                >
                    {validationMessage ||
                        "A diferença deve ser de pelo menos 20 minutos."}
                </p>
            </Card>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}

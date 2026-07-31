"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

interface PreparationTimeCardProps {
    restaurantId: string;
    initialMin?: number | null;
    initialMax?: number | null;
}

export default function PreparationTimeCard({
    restaurantId,
    initialMin,
    initialMax,
}: PreparationTimeCardProps) {
    const [minimum, setMinimum] = useState(String(initialMin ?? 40));
    const [maximum, setMaximum] = useState(String(initialMax ?? 50));
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    const save = async () => {
        const min = Number(minimum);
        const max = Number(maximum);

        if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min + 20) {
            setToast({
                message: "O tempo máximo deve ser pelo menos 20 minutos maior que o mínimo.",
                type: "error",
            });
            return;
        }

        setSaving(true);

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

            setToast({ message: "Tempo de preparo salvo!", type: "success" });
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Erro ao salvar o tempo.",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Card className="border border-gray-200 shadow-sm">
                <h2 className="mb-2 text-xl font-semibold">
                    Tempo médio de preparo
                </h2>
                <p className="mb-5 text-sm text-gray-500">
                    Defina a estimativa exibida aos clientes.
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

                <p className="mt-2 text-xs text-gray-500">
                    A diferença deve ser de pelo menos 20 minutos.
                </p>

                <div className="mt-5 flex justify-end">
                    <Button onClick={save} loading={saving}>
                        Salvar
                    </Button>
                </div>
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

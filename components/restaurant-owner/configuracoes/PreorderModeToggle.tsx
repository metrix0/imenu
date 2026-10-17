"use client";

import { useState } from "react";
import Switch from "@/components/ui/Switch";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SaveStatus from "@/components/ui/SaveStatus";

type Props = {
    restaurantId: string | null;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
};

export default function PreorderModeToggle({ restaurantId, enabled, onChange }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    const saveMode = async (nextEnabled: boolean) => {
        if (!restaurantId || saving) return;
        setSaving(true);
        setError(false);
        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preorder_only: nextEnabled, ...(nextEnabled ? { allow_future_order_scheduling: true } : {}) }),
            });
            if (!response.ok) throw new Error("Falha ao salvar modo encomendas.");
            onChange(nextEnabled);
            setConfirmOpen(false);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div>
                    <p className="font-medium text-gray-900">Trabalho apenas com encomendas</p>
                    <p className="mt-1 text-sm text-gray-500">
                        Clientes escolhem o dia da entrega ou retirada, sem selecionar um horário.
                    </p>
                    {enabled && <p className="mt-2 text-xs font-medium text-green-700">Modo encomendas ativo</p>}
                    {error && <p role="alert" className="mt-2 text-sm text-red-600">Não foi possível salvar. Tente novamente.</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {saving && <SaveStatus status="saving" />}
                    <Switch
                        checked={enabled}
                        aria-label="Trabalho apenas com encomendas"
                        disabled={!restaurantId || saving}
                        onClick={() => enabled ? void saveMode(false) : setConfirmOpen(true)}
                    />
                </div>
            </div>
            <ConfirmModal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => void saveMode(true)}
                title="Ativar modo encomendas?"
                description="Seus clientes poderão encomendar para uma data escolhida, sem selecionar horário. A loja aceitará encomendas mesmo fora do horário normal. Seus horários atuais serão preservados, mas deixarão de controlar os pedidos. O agendamento será automaticamente alterado para Dias futuros."
                confirmLabel="Ativar encomendas"
                variant="primary"
                isLoading={saving}
            />
        </>
    );
}

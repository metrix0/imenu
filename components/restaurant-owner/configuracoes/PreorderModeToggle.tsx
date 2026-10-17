"use client";

import { useState } from "react";
import Switch from "@/components/ui/Switch";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SaveStatus from "@/components/ui/SaveStatus";
import { supabase } from "@/lib/database/supabaseClient";

type Props = {
    restaurantId: string | null;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
};

export default function PreorderModeToggle({ restaurantId, enabled, onChange }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveMode = async (nextEnabled: boolean) => {
        if (!restaurantId || saving) return;
        setSaving(true);
        setError(null);
        try {
            const { data, error: saveError } = await supabase
                .from("restaurants")
                .update({
                    preorder_only: nextEnabled,
                    ...(nextEnabled ? { allow_future_order_scheduling: true } : {}),
                })
                .eq("id", restaurantId)
                .select("preorder_only")
                .single();
            if (saveError) throw saveError;
            if (!data) throw new Error("Restaurante não encontrado ou sem permissão.");
            onChange(nextEnabled);
            setConfirmOpen(false);
        } catch (err) {
            console.error("Erro ao atualizar modo encomendas:", err);
            setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
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
                        Permite receber agendamentos para dias futuros, usando o agendamento normal do iMenu.
                    </p>
                    {enabled && <p className="mt-2 text-xs font-medium text-green-700">Modo encomendas ativo</p>}
                    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
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
                description="O agendamento de pedidos será automaticamente alterado para Dias futuros. Seus horários cadastrados serão preservados e ficarão ocultos nesta tela enquanto o modo estiver ativo. Os clientes continuam usando o agendamento normal do iMenu."
                confirmLabel="Ativar encomendas"
                variant="primary"
                isLoading={saving}
            />
        </>
    );
}

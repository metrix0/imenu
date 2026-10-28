"use client";

import { useEffect, useRef, useState } from "react";
import Switch from "@/components/ui/Switch";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SaveStatus from "@/components/ui/SaveStatus";
import Input from "@/components/ui/Input";
import WeeklyScheduleClick, { type Availability } from "@/components/restaurant-owner/configuracoes/WeeklyScheduleClick";
import { supabase } from "@/lib/database/supabaseClient";

type Props = {
    restaurantId: string | null;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    openConfirmationSignal?: number;
};

export default function PreorderModeToggle({ restaurantId, enabled, onChange, openConfirmationSignal = 0 }: Props) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const seenConfirmationSignal = useRef(openConfirmationSignal);

    useEffect(() => {
        if (openConfirmationSignal === seenConfirmationSignal.current) return;
        seenConfirmationSignal.current = openConfirmationSignal;
        if (!enabled) setConfirmOpen(true);
    }, [openConfirmationSignal, enabled]);
    const [saving, setSaving] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preorderHours, setPreorderHours] = useState<Availability>({});
    const [minDays, setMinDays] = useState(0);
    const [savedMinDays, setSavedMinDays] = useState(0);

    useEffect(() => {
        if (!enabled || !restaurantId) return;
        let active = true;
        void supabase.from("restaurants")
            .select("preorder_availability_json,preorder_min_days")
            .eq("id", restaurantId).single()
            .then(({ data, error: loadError }) => {
                if (!active) return;
                if (loadError) {
                    setError(loadError.message);
                    return;
                }
                setPreorderHours((data?.preorder_availability_json as Availability) || {});
                setMinDays(data?.preorder_min_days ?? 0);
                setSavedMinDays(data?.preorder_min_days ?? 0);
            });
        return () => { active = false; };
    }, [enabled, restaurantId]);

    const showError = (err: unknown) => {
        console.error("Erro ao configurar encomendas:", err);
        setError(err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message : "Não foi possível salvar. Tente novamente.");
    };

    const saveMode = async (nextEnabled: boolean) => {
        if (!restaurantId || saving) return;
        setSaving(true);
        setError(null);
        try {
            // Keep regular opening hours separate from the hours offered for preorders.
            const current = nextEnabled
                ? await supabase.from("restaurants")
                    .select("availability_json,preorder_availability_json")
                    .eq("id", restaurantId).single()
                : null;
            if (current?.error) throw current.error;
            const { data, error: saveError } = await supabase
                .from("restaurants")
                .update({
                    preorder_only: nextEnabled,
                    ...(nextEnabled ? {
                        allow_future_order_scheduling: true,
                        preorder_availability_json:
                            current?.data?.preorder_availability_json ??
                            current?.data?.availability_json ?? {},
                    } : {}),
                })
                .eq("id", restaurantId)
                .select("preorder_only,preorder_availability_json,preorder_min_days")
                .single();
            if (saveError) throw saveError;
            if (!data) throw new Error("Restaurante não encontrado ou sem permissão.");
            setPreorderHours((data.preorder_availability_json as Availability) || {});
            setMinDays(data.preorder_min_days ?? 0);
            setSavedMinDays(data.preorder_min_days ?? 0);
            onChange(nextEnabled);
            setConfirmOpen(false);
        } catch (err) {
            showError(err);
        } finally {
            setSaving(false);
        }
    };

    const saveHours = async (hours: Availability) => {
        if (!restaurantId) return;
        const previous = preorderHours;
        setPreorderHours(hours);
        setSavingSettings(true);
        setError(null);
        const { error: saveError } = await supabase.from("restaurants")
            .update({ preorder_availability_json: hours })
            .eq("id", restaurantId);
        if (saveError) {
            setPreorderHours(previous);
            showError(saveError);
        }
        setSavingSettings(false);
    };

    const saveDays = async () => {
        if (!restaurantId || minDays === savedMinDays) return;
        const days = Number(minDays);
        if (!Number.isInteger(days) || days < 0 || days > 59) {
            setError("Informe entre 0 e 59 dias.");
            setMinDays(savedMinDays);
            return;
        }
        setSavingSettings(true);
        setError(null);
        const { error: saveError } = await supabase.from("restaurants")
            .update({ preorder_min_days: days })
            .eq("id", restaurantId);
        if (saveError) {
            setMinDays(savedMinDays);
            showError(saveError);
        } else {
            setSavedMinDays(days);
        }
        setSavingSettings(false);
    };

    return (
        <>
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                <div>
                    <p className="font-medium text-gray-900">Trabalho apenas com encomendas</p>
                    <p className="mt-1 text-sm text-gray-500">
                        Os clientes devem agendar o dia e o horário da encomenda.
                    </p>
                    {enabled && <p className="mt-2 text-xs font-medium text-green-700">Modo encomendas ativo</p>}
                    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <SaveStatus status={error ? "error" : saving || savingSettings ? "saving" : "saved"} />
                    <Switch
                        checked={enabled}
                        aria-label="Trabalho apenas com encomendas"
                        disabled={!restaurantId || saving}
                        onClick={() => enabled ? void saveMode(false) : setConfirmOpen(true)}
                    />
                </div>
            </div>

            {enabled && (
                <div className="space-y-5">
                    <div>
                        <h2 className="mb-1 text-lg font-medium text-gray-900">Horários em que encomendas são feitas</h2>
                        <p className="mb-3 text-sm text-gray-500">Defina os dias e horários disponíveis para agendar entregas ou retiradas de encomendas.</p>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white px-3 py-4 sm:p-5">
                            <div className="min-w-[700px]">
                                <WeeklyScheduleClick value={preorderHours} onChange={saveHours} />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                        <Input
                            label="Dias até encomenda"
                            type="number"
                            min={0}
                            max={59}
                            step={1}
                            value={minDays}
                            onChange={(event) => setMinDays(Number(event.target.value))}
                            onBlur={() => void saveDays()}
                            className="max-w-40"
                        />
                        <p className="mt-2 text-sm text-gray-500">
                            Antecedência mínima para realizar um pedido. Use 0 para permitir encomendas no mesmo dia.
                        </p>
                    </div>
                </div>
            )}
            <ConfirmModal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => void saveMode(true)}
                title="Ativar modo encomendas?"
                description="O agendamento de pedidos será obrigatório e passará automaticamente para Dias futuros. Os horários normais serão preservados. Configure abaixo os horários das encomendas e a antecedência mínima."
                confirmLabel="Ativar encomendas"
                variant="primary"
                isLoading={saving}
            />
        </>
    );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { faChevronDown, faClock, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { supabase } from "@/lib/database/supabaseClient";
import {
    CATEGORY_WEEKDAYS,
    categoryScheduleLabel,
    validateCategorySchedule,
    type CategorySchedule,
    type CategoryScheduleRule,
} from "@/lib/menu/categorySchedule";
import type { Category } from "@/lib/types/types";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface ManageCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
    categoryToEdit?: { id: string; name: string; availability_schedule?: CategorySchedule } | null;
}

const emptyRule = (): CategoryScheduleRule => ({ days: [], start: null, end: null });

export default function ManageCategoryModal({
    isOpen,
    onClose,
    onSuccess,
    restaurantId,
    categoryToEdit,
}: ManageCategoryModalProps) {
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduled, setScheduled] = useState(false);
    const [rules, setRules] = useState<CategoryScheduleRule[]>([emptyRule()]);
    const [scheduleError, setScheduleError] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setName(categoryToEdit?.name || "");
        const existing = categoryToEdit?.availability_schedule;
        setScheduled(Array.isArray(existing) && existing.length > 0);
        setRules(Array.isArray(existing) && existing.length > 0
            ? existing.map(rule => ({ ...rule, days: [...rule.days] }))
            : [emptyRule()]);
        setScheduleOpen(false);
        setScheduleError("");
    }, [isOpen, categoryToEdit]);

    const updateRule = (index: number, update: Partial<CategoryScheduleRule>) => {
        setRules(current => current.map((rule, i) => i === index ? { ...rule, ...update } : rule));
        setScheduleError("");
    };

    const toggleDay = (index: number, day: number) => {
        const current = rules[index].days;
        updateRule(index, {
            days: current.includes(day) ? current.filter(value => value !== day) : [...current, day],
        });
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        const schedule: CategorySchedule = scheduled ? rules : null;
        const errorMessage = validateCategorySchedule(schedule);
        if (errorMessage) {
            setScheduleOpen(true);
            setScheduleError(errorMessage);
            return;
        }

        setIsLoading(true);
        try {
            if (categoryToEdit) {
                const { error } = await supabase
                    .from("categories")
                    .update({ name: name.trim(), availability_schedule: schedule })
                    .eq("id", categoryToEdit.id);
                if (error) throw error;
            } else {
                const { count, error: countError } = await supabase
                    .from("categories")
                    .select("*", { count: "exact", head: true })
                    .eq("restaurant_id", restaurantId);
                if (countError) throw countError;
                const { error } = await supabase
                    .from("categories")
                    .insert({
                        name: name.trim(),
                        restaurant_id: restaurantId,
                        position: (count || 0) + 1,
                        availability_schedule: schedule,
                    });
                if (error) throw error;
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Erro ao salvar categoria:", error);
            alert(`Erro ao salvar categoria: ${error.message || "Erro desconhecido"}`);
        } finally {
            setIsLoading(false);
        }
    };

    const executeDelete = async () => {
        if (!categoryToEdit) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from("categories").delete().eq("id", categoryToEdit.id);
            if (error) throw error;
            onSuccess();
            setIsDeleteModalOpen(false);
            onClose();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Não foi possível deletar (verifique se há itens vinculados).");
            setIsDeleteModalOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Modal height={680} open={isOpen} onClose={onClose}>
                <div className="w-full space-y-5 p-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {categoryToEdit ? "Editar categoria" : "Adicionar categoria"}
                    </h2>

                    <Input
                        label="Nome da categoria"
                        placeholder="Ex: Bebidas, Lanches..."
                        value={name}
                        onChange={event => setName(event.target.value)}
                        autoFocus
                    />

                    <div className="rounded-lg border border-gray-200">
                        <button
                            type="button"
                            aria-expanded={scheduleOpen}
                            aria-controls="category-schedule-panel"
                            onClick={() => setScheduleOpen(value => !value)}
                            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <FontAwesomeIcon icon={faClock} className="shrink-0 text-gray-500" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">Disponibilidade da categoria</span>
                                    <span className="block truncate text-xs text-gray-500">
                                        {scheduled ? categoryScheduleLabel(rules) || "Definir horários" : "Sempre disponível"}
                                    </span>
                                </span>
                            </span>
                            <FontAwesomeIcon icon={faChevronDown} className={`shrink-0 text-gray-500 transition-transform duration-200 ${scheduleOpen ? "rotate-180" : ""}`} />
                        </button>

                        {scheduleOpen && (
                            <div id="category-schedule-panel" className="space-y-4 border-t border-gray-200 p-4">
                                <p className="text-xs leading-5 text-gray-500">
                                    Esta opção controla quando a categoria aparece no cardápio. Não altera os horários em que o restaurante aceita pedidos.{" "}
                                    <Link href="/painel/disponibilidade" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                                        Ver horários do restaurante
                                    </Link>
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="secondary" className={`!text-xs ${!scheduled ? "!border-brand !text-brand" : ""}`} onClick={() => { setScheduled(false); setScheduleError(""); }}>
                                        Sempre disponível
                                    </Button>
                                    <Button variant="secondary" className={`!text-xs ${scheduled ? "!border-brand !text-brand" : ""}`} onClick={() => { setScheduled(true); setScheduleError(""); }}>
                                        Agendar exibição
                                    </Button>
                                </div>

                                {scheduled && (
                                    <div className="space-y-3">
                                        {rules.map((rule, index) => (
                                            <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-medium text-gray-700">
                                                        {rules.length > 1 ? `Intervalo ${index + 1}` : "Dias e horários"}
                                                    </span>
                                                    {rules.length > 1 && (
                                                        <button type="button" className="cursor-pointer text-xs text-gray-500 hover:text-red-600" onClick={() => setRules(current => current.filter((_, i) => i !== index))}>
                                                            Remover intervalo
                                                        </button>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="mb-2 text-xs font-medium text-gray-600">Dias da semana</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <button type="button" aria-pressed={rule.days.length === 0} onClick={() => updateRule(index, { days: [] })}
                                                            className={`cursor-pointer rounded-md border px-2.5 py-2 text-xs ${!rule.days.length ? "border-brand bg-orange-50 text-brand" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                                                            Todos
                                                        </button>
                                                        {CATEGORY_WEEKDAYS.map(({ day, label }) => (
                                                            <button key={day} type="button" aria-pressed={rule.days.includes(day)} onClick={() => toggleDay(index, day)}
                                                                className={`cursor-pointer rounded-md border px-2.5 py-2 text-xs ${rule.days.includes(day) ? "border-brand bg-orange-50 text-brand" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                                                    <input type="checkbox" className="h-4 w-4 accent-brand" checked={rule.start !== null}
                                                        onChange={event => updateRule(index, event.target.checked ? { start: "11:00", end: "14:00" } : { start: null, end: null })} />
                                                    Limitar por horário
                                                </label>
                                                {rule.start !== null && (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input label="Das" type="time" value={rule.start} onChange={event => updateRule(index, { start: event.target.value })} />
                                                        <Input label="Até" type="time" value={rule.end || ""} onChange={event => updateRule(index, { end: event.target.value })} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button variant="secondary" className="flex items-center gap-2 !text-xs" onClick={() => { setRules(current => [...current, emptyRule()]); setScheduleError(""); }}>
                                            <FontAwesomeIcon icon={faPlus} /> Adicionar intervalo
                                        </Button>
                                        <p className="text-xs text-gray-500">
                                            Sem horário definido, vale o dia inteiro. Horários que passam da meia-noite continuam no dia seguinte. Horário de Brasília.
                                        </p>
                                    </div>
                                )}
                                {scheduleError && <p role="alert" className="text-xs text-red-600">{scheduleError}</p>}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                        {categoryToEdit && (
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(true)} disabled={isLoading} className="mr-auto text-red-600">
                                Excluir
                            </Button>
                        )}
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                        <Button onClick={handleSave} loading={isLoading} disabled={isLoading || !name.trim()}>Salvar</Button>
                    </div>
                </div>
            </Modal>
            <ConfirmModal
                open={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={executeDelete}
                title="Excluir categoria"
                description={`Tem certeza que deseja excluir "${categoryToEdit?.name}"? Isso pode ocultar os itens que pertencem a ela.`}
                confirmLabel="Excluir categoria"
                isLoading={isLoading}
                variant="danger"
            />
        </>
    );
}

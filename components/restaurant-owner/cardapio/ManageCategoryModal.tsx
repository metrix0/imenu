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
import Dropdown, { type DropdownOption } from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";

interface ManageCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
    categoryToEdit?: { id: string; name: string; availability_schedule?: CategorySchedule } | null;
}

const ALL_DAYS = CATEGORY_WEEKDAYS.map(({ day }) => day);
const emptyRule = (): CategoryScheduleRule => ({ days: [...ALL_DAYS], start: null, end: null });
const TIME_OPTIONS: DropdownOption[] = [
    ...Array.from({ length: 96 }, (_, index) => {
        const time = `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`;
        return { value: time, label: time };
    }),
    { value: "23:59", label: "23:59" },
];
const timeOptionsFor = (value: string): DropdownOption[] =>
    TIME_OPTIONS.some(option => option.value === value)
        ? TIME_OPTIONS
        : [...TIME_OPTIONS, { value, label: value }].sort((a, b) => String(a.value).localeCompare(String(b.value)));

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
    const [closingInterval, setClosingInterval] = useState<number | null>(null);

    useEffect(() => {
        if (closingInterval === null) return;
        const timer = window.setTimeout(() => {
            setRules(current => current.filter((_, index) => index !== closingInterval));
            setClosingInterval(null);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [closingInterval]);

    useEffect(() => {
        if (!isOpen) return;
        setName(categoryToEdit?.name || "");
        const existing = categoryToEdit?.availability_schedule;
        setScheduled(Array.isArray(existing) && existing.length > 0);
        setRules(Array.isArray(existing) && existing.length > 0
            ? existing.map(rule => ({ ...rule, days: rule.days.length ? [...rule.days] : [...ALL_DAYS] }))
            : [emptyRule()]);
        setClosingInterval(null);
        setScheduleOpen(false);
        setScheduleError("");
    }, [isOpen, categoryToEdit]);

    const updateRule = (index: number, update: Partial<CategoryScheduleRule>) => {
        setRules(current => current.map((rule, i) => i === index ? { ...rule, ...update } : rule));
        setScheduleError("");
    };

    const toggleDay = (index: number, day: number) => {
        const current = rules[index].days;
        if (current.length === 1 && current.includes(day)) return;
        updateRule(index, {
            days: current.includes(day) ? current.filter(value => value !== day) : [...current, day],
        });
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        const schedule: CategorySchedule = scheduled
            ? rules.filter((_, index) => index !== closingInterval)
            : null;
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

                        <div
                            id="category-schedule-panel"
                            aria-hidden={!scheduleOpen}
                            inert={!scheduleOpen}
                            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${scheduleOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                        >
                            <div className="min-h-0 overflow-hidden">
                                <div className="space-y-4 border-t border-gray-200 p-4">
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

                                    <div
                                        aria-hidden={!scheduled}
                                        inert={!scheduled}
                                        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${scheduled ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                                    >
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="space-y-3 pt-1">
                                                {rules.map((rule, index) => (
                                                    <div
                                                        key={index}
                                                        aria-hidden={index === closingInterval}
                                                        inert={index === closingInterval}
                                                        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${index === closingInterval ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
                                                    >
                                                        <div className="min-h-0 overflow-hidden">
                                                            <div className="space-y-3 rounded-lg border border-gray-200 p-3 motion-safe:animate-fadeUp">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-xs font-medium text-gray-700">
                                                                        {rules.length > 1 ? `Intervalo ${index + 1}` : "Dias e horários"}
                                                                    </span>
                                                                    {rules.length > 1 && index !== closingInterval && (
                                                                        <button type="button" className="cursor-pointer text-xs text-gray-500 transition-colors hover:text-red-600" onClick={() => setClosingInterval(index)}>
                                                                            Remover intervalo
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="mb-2 text-xs font-medium text-gray-600">Dias da semana</p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {CATEGORY_WEEKDAYS.map(({ day, label }) => (
                                                                            <Button key={day} variant="secondary" aria-pressed={rule.days.includes(day)}
                                                                                onClick={() => toggleDay(index, day)}
                                                                                className={`!min-h-9 !px-2.5 !py-1.5 !text-xs ${rule.days.includes(day) ? "!border-[#d93d00] !bg-[#fff1ea] !text-[#c43700]" : ""}`}>
                                                                                {label}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span id={`category-time-toggle-${index}`} className="text-xs text-gray-700">Limitar por horário</span>
                                                                    <Switch checked={rule.start !== null} aria-labelledby={`category-time-toggle-${index}`}
                                                                        onClick={() => updateRule(index, rule.start !== null
                                                                            ? { start: null, end: null }
                                                                            : { start: "11:00", end: "14:00" })} />
                                                                </div>
                                                                <div
                                                                    aria-hidden={rule.start === null}
                                                                    inert={rule.start === null}
                                                                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${rule.start !== null ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                                                                >
                                                                    <div className="min-h-0 overflow-hidden">
                                                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                                                            <Dropdown custom label="Das" options={timeOptionsFor(rule.start || "11:00")} value={rule.start || "11:00"}
                                                                                onChange={event => updateRule(index, { start: event.target.value })} />
                                                                            <Dropdown custom label="Até" options={timeOptionsFor(rule.end || "14:00")} value={rule.end || "14:00"}
                                                                                onChange={event => updateRule(index, { end: event.target.value })} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                <Button variant="secondary" className="flex items-center gap-2 !text-xs" onClick={() => { setRules(current => [...current, emptyRule()]); setScheduleError(""); }}>
                                                    <FontAwesomeIcon icon={faPlus} /> Adicionar intervalo
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {scheduleError && <p role="alert" className="text-xs text-red-600">{scheduleError}</p>}
                                </div>
                            </div>
                        </div>
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

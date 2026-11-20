"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { faChevronDown, faClock, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Dropdown, { type DropdownOption } from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import {
    CATEGORY_WEEKDAYS,
    categoryScheduleLabel,
    validateCategorySchedule,
    type CategorySchedule,
    type CategoryScheduleRule,
} from "@/lib/menu/categorySchedule";

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

function draftRules(schedule: CategorySchedule | undefined) {
    return schedule?.length
        ? schedule.map(rule => ({ ...rule, days: rule.days.length ? [...rule.days] : [...ALL_DAYS] }))
        : [emptyRule()];
}

export function useAvailabilityScheduleEditor(
    initialSchedule: CategorySchedule | undefined,
    onChange?: (schedule: CategorySchedule) => void,
) {
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduled, setScheduled] = useState(Boolean(initialSchedule?.length));
    const [rules, setRules] = useState(() => draftRules(initialSchedule));
    const [untouchedRules, setUntouchedRules] = useState<CategoryScheduleRule[]>([]);
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

    const reset = useCallback((schedule: CategorySchedule | undefined) => {
        setScheduled(Boolean(schedule?.length));
        setRules(draftRules(schedule));
        setUntouchedRules([]);
        setClosingInterval(null);
        setScheduleOpen(false);
        setScheduleError("");
    }, []);

    const showError = (error: string) => {
        setScheduleError(error);
        setScheduleOpen(true);
    };

    const selectRules = (enabled: boolean, allRules: CategoryScheduleRule[], removed: number | null, untouched: CategoryScheduleRule[]) =>
        enabled ? allRules.filter((rule, index) => index !== removed && !untouched.includes(rule)) : null;

    const publish = (schedule: CategorySchedule) => {
        const error = onChange ? validateCategorySchedule(schedule) : null;
        setScheduleError(error ?? "");
        if (!error) onChange?.(schedule);
    };

    const changeMode = (enabled: boolean) => {
        if (scheduled === enabled) return;
        setScheduled(enabled);
        publish(selectRules(enabled, rules, closingInterval, untouchedRules));
    };

    const updateRule = (index: number, update: Partial<CategoryScheduleRule>) => {
        const editedRule = rules[index];
        const nextRules = rules.map((rule, i) => i === index ? { ...rule, ...update } : rule);
        const nextUntouched = untouchedRules.filter(rule => rule !== editedRule);
        setRules(nextRules);
        setUntouchedRules(nextUntouched);
        publish(selectRules(scheduled, nextRules, closingInterval, nextUntouched));
    };

    const toggleDay = (index: number, day: number) => {
        const days = rules[index].days;
        if (days.length === 1 && days.includes(day)) return;
        updateRule(index, { days: days.includes(day) ? days.filter(value => value !== day) : [...days, day] });
    };

    const removeInterval = (index: number) => {
        const nextUntouched = untouchedRules.filter(rule => rule !== rules[index]);
        setUntouchedRules(nextUntouched);
        setClosingInterval(index);
        publish(selectRules(scheduled, rules, index, nextUntouched));
    };

    const addInterval = () => {
        const rule = emptyRule();
        setRules([...rules, rule]);
        // An untouched interval with every day selected would widen an autosaved schedule.
        if (onChange) setUntouchedRules([...untouchedRules, rule]);
        else setScheduleError("");
    };

    const schedule = selectRules(scheduled, rules, closingInterval, untouchedRules);
    return {
        schedule, scheduleOpen, setScheduleOpen, scheduled, rules, scheduleError,
        closingInterval, reset, showError, changeMode, updateRule, toggleDay, removeInterval,
        addInterval,
    };
}

export default function AvailabilityScheduleEditor({
    editor,
    subject,
}: {
    editor: ReturnType<typeof useAvailabilityScheduleEditor>;
    subject: "da categoria" | "do item";
}) {
    const panelId = useId();
    const {
        scheduleOpen, setScheduleOpen, scheduled, rules, scheduleError, closingInterval,
        changeMode, updateRule, toggleDay, removeInterval, addInterval,
    } = editor;

    return (
        <div className="rounded-lg border border-gray-200">
            <button
                type="button"
                aria-expanded={scheduleOpen}
                aria-controls={panelId}
                onClick={() => setScheduleOpen(value => !value)}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <FontAwesomeIcon icon={faClock} className="shrink-0 text-gray-500" />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium">Disponibilidade {subject}</span>
                        <span className="block truncate text-xs text-gray-500">
                            {scheduled ? categoryScheduleLabel(editor.schedule) || "Definir horários" : "Sempre disponível"}
                        </span>
                    </span>
                </span>
                <FontAwesomeIcon icon={faChevronDown} className={`shrink-0 text-gray-500 transition-transform duration-200 ${scheduleOpen ? "rotate-180" : ""}`} />
            </button>

            <div
                id={panelId}
                aria-hidden={!scheduleOpen}
                inert={!scheduleOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${scheduleOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="space-y-4 border-t border-gray-200 p-4">
                        <p className="text-xs leading-5 text-gray-500">
                            Esta opção controla quando {subject === "da categoria" ? "a categoria aparece" : "o item aparece"} no cardápio. Não altera os horários em que o restaurante aceita pedidos.{" "}
                            <Link href="/painel/disponibilidade" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                                Ver horários do restaurante
                            </Link>
                        </p>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" className={`!text-xs ${!scheduled ? "!border-brand !text-brand" : ""}`} onClick={() => changeMode(false)}>
                                Sempre disponível
                            </Button>
                            <Button variant="secondary" className={`!text-xs ${scheduled ? "!border-brand !text-brand" : ""}`} onClick={() => changeMode(true)}>
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
                                                            <button type="button" className="cursor-pointer text-xs text-gray-500 transition-colors hover:text-red-600" disabled={closingInterval !== null} onClick={() => removeInterval(index)}>
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
                                                        <span id={`${panelId}-time-toggle-${index}`} className="text-xs text-gray-700">Limitar por horário</span>
                                                        <Switch checked={rule.start !== null} aria-labelledby={`${panelId}-time-toggle-${index}`}
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
                                    <Button variant="secondary" className="flex items-center gap-2 !text-xs" onClick={addInterval}>
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
    );
}

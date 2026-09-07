"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import { DATE_FILTER_PRESETS, formatDate, formatRangeDate, parseDate, type DateRange, type DateFilterPreset } from "@/lib/utils/dateRange";

export default function DateRangePicker({ value, onChange, presets = DATE_FILTER_PRESETS, allowClear = false }: {
    value: DateRange; onChange: (range: DateRange) => void; presets?: DateFilterPreset[]; allowClear?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [selectingEnd, setSelectingEnd] = useState(false);
    const [hoverDate, setHoverDate] = useState("");
    const [month, setMonth] = useState(() => parseDate(value.endDate || formatDate(new Date())));
    const [position, setPosition] = useState<CSSProperties>({});
    const trigger = useRef<HTMLButtonElement>(null);
    const popup = useRef<HTMLDivElement>(null);
    const today = formatDate(new Date());
    useEffect(() => {
        if (!open) return;
        const locate = () => {
            const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
            const width = Math.min(360, window.innerWidth - 24);
            const height = Math.min(popup.current?.scrollHeight || 600, window.innerHeight - 24);
            setPosition({ position: "fixed", width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12)), maxHeight: height });
        };
        const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false); };
        locate(); window.addEventListener("resize", locate); window.addEventListener("scroll", locate, true); document.addEventListener("pointerdown", outside);
        return () => { window.removeEventListener("resize", locate); window.removeEventListener("scroll", locate, true); document.removeEventListener("pointerdown", outside); };
    }, [open]);
    const toggle = () => { if (!open) { setDraft(value); setSelectingEnd(false); setHoverDate(""); setMonth(parseDate(value.endDate || today)); } setOpen(!open); };
    const apply = (range: DateRange) => { onChange(range); setOpen(false); trigger.current?.focus(); };
    const chooseDay = (date: string) => {
        if (!selectingEnd) { setDraft({ startDate: date, endDate: date }); setSelectingEnd(true); }
        else { setDraft({ startDate: date < draft.startDate ? date : draft.startDate, endDate: date < draft.startDate ? draft.startDate : date }); setSelectingEnd(false); setHoverDate(""); }
    };
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const cells = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1));
    const previewEnd = selectingEnd && hoverDate ? hoverDate : draft.endDate;
    const rangeStart = draft.startDate < previewEnd ? draft.startDate : previewEnd;
    const rangeEnd = draft.startDate > previewEnd ? draft.startDate : previewEnd;
    return <div data-ui="field" className="min-w-0">
        <span data-ui="field-label">Período</span>
        <button ref={trigger} type="button" data-ui="dropdown-trigger" aria-label="Selecionar período" aria-haspopup="dialog" aria-expanded={open}
            className="flex w-full items-center gap-3 rounded-lg border bg-white px-3 text-left" onClick={toggle}>
            <CalendarDays size={16} className="shrink-0 text-gray-500" />
            <span className="min-w-0 flex-1 truncate">{value.startDate && value.endDate ? `${formatRangeDate(value.startDate)} — ${formatRangeDate(value.endDate)}` : "Todo o período"}</span>
            <ChevronDown size={14} className={open ? "rotate-180" : ""} />
        </button>
        {open && createPortal(<div ref={popup} style={position} className="panel-essencial panel-date-picker" role="dialog" aria-label="Escolher período"
            onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
            <div className="grid grid-cols-2 gap-2 border-b border-gray-200 p-4">
                {presets.map(preset => <button key={preset.label} type="button" className="rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => apply(preset.getRange())}>{preset.label}</button>)}
                {allowClear && <button type="button" className="col-span-2 rounded-md px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50" onClick={() => apply({ startDate: "", endDate: "" })}>Todo o período</button>}
            </div>
            <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <button type="button" aria-label="Mês anterior" className="calendar-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                    <span className="font-medium capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                    <button type="button" aria-label="Próximo mês" className="calendar-nav" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 text-center text-xs text-gray-500">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={index} className="py-2">{day}</span>)}</div>
                <div className="calendar-grid grid grid-cols-7" onMouseLeave={() => setHoverDate("")}>
                    {cells.map(date => { const day = formatDate(date); const selected = day === draft.startDate || day === previewEnd; const between = Boolean(rangeStart && day > rangeStart && day < rangeEnd);
                        return <button key={day} type="button" aria-label={date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} aria-pressed={selected}
                            data-date={day} data-outside={date.getMonth() !== month.getMonth()} data-range={between} disabled={day > today}
                            onMouseEnter={() => selectingEnd && setHoverDate(day)} onClick={() => chooseDay(day)}
                            onKeyDown={event => { const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key]; if (offset) { event.preventDefault(); const next = new Date(date); next.setDate(next.getDate() + offset); popup.current?.querySelector<HTMLButtonElement>(`[data-date="${formatDate(next)}"]`)?.focus(); } }}>
                            {date.getDate()}
                        </button>;
                    })}
                </div>
                <p className="my-3 text-xs text-gray-500">{selectingEnd ? "Agora selecione a data final." : "Selecione o início e o fim do período."}</p>
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Início" type="date" max={today} value={draft.startDate} onChange={event => { setDraft({ ...draft, startDate: event.target.value }); setSelectingEnd(false); }} />
                    <Input label="Fim" type="date" min={draft.startDate} max={today} value={draft.endDate} onChange={event => { setDraft({ ...draft, endDate: event.target.value }); setSelectingEnd(false); }} />
                </div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Cancelar</Button><Button disabled={!draft.startDate || !draft.endDate || draft.endDate < draft.startDate || draft.endDate > today} onClick={() => apply(draft)}>Aplicar</Button></div>
            </div>
        </div>, document.body)}
    </div>;
}

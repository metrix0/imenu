"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarDays,
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

import Card from "@/components/ui/Card";

export type DateRange = {
    startDate: string;
    endDate: string;
};

export type DateFilterPreset = {
    label: string;
    getRange: () => DateRange;
};

const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatRangeDate(value: string): string {
    return parseDate(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function getDateRangeForDays(days: number): DateRange {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(days - 1, 0));

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}

export function getCurrentMonthRange(): DateRange {
    const today = new Date();
    return {
        startDate: formatDate(
            new Date(today.getFullYear(), today.getMonth(), 1)
        ),
        endDate: formatDate(today),
    };
}

export function getPreviousMonthRange(): DateRange {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}

export const DATE_FILTER_PRESETS: DateFilterPreset[] = [
    { label: "Hoje", getRange: () => getDateRangeForDays(1) },
    { label: "7 dias", getRange: () => getDateRangeForDays(7) },
    { label: "30 dias", getRange: () => getDateRangeForDays(30) },
    { label: "90 dias", getRange: () => getDateRangeForDays(90) },
];

interface DateFilterBarProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    showPresets?: boolean;
    presets?: DateFilterPreset[];
}

export default function DateFilterBar({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    showPresets = false,
    presets = DATE_FILTER_PRESETS,
}: DateFilterBarProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [draftStart, setDraftStart] = useState<string | null>(null);
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const date = parseDate(endDate);
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });

    useEffect(() => {
        if (!calendarOpen) return;

        const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!rootRef.current?.contains(target)) {
                setCalendarOpen(false);
                setDraftStart(null);
            }
        };

        document.addEventListener("mousedown", closeOnOutsideClick);
        document.addEventListener("touchstart", closeOnOutsideClick);

        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick);
            document.removeEventListener("touchstart", closeOnOutsideClick);
        };
    }, [calendarOpen]);

    const calendarDays = useMemo(() => {
        const year = visibleMonth.getFullYear();
        const month = visibleMonth.getMonth();
        const firstWeekDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return [
            ...Array.from({ length: firstWeekDay }, () => null),
            ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
        ];
    }, [visibleMonth]);

    const setPreset = (preset: DateFilterPreset) => {
        const range = preset.getRange();
        onStartDateChange(range.startDate);
        onEndDateChange(range.endDate);
        setDraftStart(null);
        setCalendarOpen(false);
    };

    const toggleCalendar = () => {
        const date = parseDate(endDate);
        setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setDraftStart(null);
        setCalendarOpen((open) => !open);
    };

    const selectDate = (date: string) => {
        if (!draftStart) {
            setDraftStart(date);
            return;
        }

        const nextStart = date < draftStart ? date : draftStart;
        const nextEnd = date < draftStart ? draftStart : date;
        onStartDateChange(nextStart);
        onEndDateChange(nextEnd);
        setDraftStart(null);
        setCalendarOpen(false);
    };

    const today = formatDate(new Date());
    const shownStart = draftStart || startDate;
    const shownEnd = draftStart ? null : endDate;

    return (
        <Card className="mb-6 border-gray-200 p-0 shadow-sm">
            <div ref={rootRef} className="relative p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 2xl:text-base">
                            Período
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500 2xl:text-sm">
                            {formatRangeDate(startDate)} — {formatRangeDate(endDate)}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={toggleCalendar}
                        aria-label="Selecionar período"
                        title="Selecionar período"
                        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                            calendarOpen
                                ? "border-brand bg-brand text-white"
                                : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                        }`}
                    >
                        <FontAwesomeIcon icon={faCalendarDays} />
                    </button>
                </div>

                {showPresets && presets.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-4">
                        {presets.map((preset) => {
                            const range = preset.getRange();
                            const active =
                                startDate === range.startDate &&
                                endDate === range.endDate;

                            return (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setPreset(preset)}
                                    className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                                        active
                                            ? "bg-white text-brand shadow-sm ring-1 ring-black/5"
                                            : "text-gray-500 hover:bg-white/70 hover:text-gray-800"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {calendarOpen && (
                    <div className="absolute right-4 top-16 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:right-5">
                        <div className="mb-3 flex items-center justify-between">
                            <button
                                type="button"
                                aria-label="Mês anterior"
                                onClick={() =>
                                    setVisibleMonth(
                                        (month) =>
                                            new Date(
                                                month.getFullYear(),
                                                month.getMonth() - 1,
                                                1
                                            )
                                    )
                                }
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>

                            <p className="font-semibold capitalize text-gray-900">
                                {visibleMonth.toLocaleDateString("pt-BR", {
                                    month: "long",
                                    year: "numeric",
                                })}
                            </p>

                            <button
                                type="button"
                                aria-label="Próximo mês"
                                onClick={() =>
                                    setVisibleMonth(
                                        (month) =>
                                            new Date(
                                                month.getFullYear(),
                                                month.getMonth() + 1,
                                                1
                                            )
                                    )
                                }
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400">
                            {WEEK_DAYS.map((day, index) => (
                                <span key={`${day}-${index}`} className="py-2">
                                    {day}
                                </span>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-y-1">
                            {calendarDays.map((day, index) => {
                                if (day === null) {
                                    return (
                                        <span
                                            key={`blank-${index}`}
                                            className="h-9"
                                        />
                                    );
                                }

                                const date = formatDate(
                                    new Date(
                                        visibleMonth.getFullYear(),
                                        visibleMonth.getMonth(),
                                        day
                                    )
                                );
                                const disabled = date > today;
                                const isStart = date === shownStart;
                                const isEnd =
                                    shownEnd !== null && date === shownEnd;
                                const inRange =
                                    shownEnd !== null &&
                                    date > shownStart &&
                                    date < shownEnd;

                                return (
                                    <button
                                        key={date}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => selectDate(date)}
                                        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors ${
                                            disabled
                                                ? "cursor-not-allowed text-gray-300"
                                                : isStart || isEnd
                                                  ? "cursor-pointer bg-brand font-semibold text-white"
                                                  : inRange
                                                    ? "cursor-pointer bg-brand/10 font-medium text-brand"
                                                    : "cursor-pointer text-gray-700 hover:bg-gray-100"
                                        }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                            {draftStart
                                ? `Início: ${formatRangeDate(draftStart)}. Agora selecione a data final.`
                                : "Selecione a data inicial e depois a data final."}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export const DATE_FILTER_PRESETS = [
    { label: "Hoje", days: 1 },
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
    { label: "90 dias", days: 90 },
] as const;

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function getDateRangeForDays(days: number) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(days - 1, 0));

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
    };
}

interface DateFilterBarProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    showPresets?: boolean;
}

export default function DateFilterBar({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    showPresets = false,
}: DateFilterBarProps) {
    const setPreset = (days: number) => {
        const range = getDateRangeForDays(days);
        onStartDateChange(range.startDate);
        onEndDateChange(range.endDate);
    };

    const handleStartDateChange = (date: string) => {
        onStartDateChange(date);
        if (date > endDate) onEndDateChange(date);
    };

    const handleEndDateChange = (date: string) => {
        onEndDateChange(date);
        if (date < startDate) onStartDateChange(date);
    };

    const calendarIcon = (
        <FontAwesomeIcon icon={faCalendarDays} className="text-sm" />
    );

    return (
        <Card className="mb-6 overflow-hidden border-gray-200 p-0 shadow-sm">
            <div className="space-y-5 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <FontAwesomeIcon icon={faCalendarDays} />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 2xl:text-base">
                            Período
                        </h2>
                        <p className="text-xs text-gray-500 2xl:text-sm">
                            Selecione o intervalo usado nos dados abaixo.
                        </p>
                    </div>
                </div>

                {showPresets && (
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-4">
                        {DATE_FILTER_PRESETS.map((preset) => {
                            const range = getDateRangeForDays(preset.days);
                            const active =
                                startDate === range.startDate &&
                                endDate === range.endDate;

                            return (
                                <button
                                    key={preset.days}
                                    type="button"
                                    onClick={() => setPreset(preset.days)}
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

                <div>
                    {showPresets && (
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Intervalo personalizado
                        </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            label="De"
                            type="date"
                            value={startDate}
                            icon={calendarIcon}
                            onChange={(event) =>
                                handleStartDateChange(event.target.value)
                            }
                            className="rounded-xl border-gray-200 py-2.5 shadow-sm"
                        />
                        <Input
                            label="Até"
                            type="date"
                            value={endDate}
                            icon={calendarIcon}
                            onChange={(event) =>
                                handleEndDateChange(event.target.value)
                            }
                            className="rounded-xl border-gray-200 py-2.5 shadow-sm"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
}

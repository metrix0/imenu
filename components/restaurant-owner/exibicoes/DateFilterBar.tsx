"use client";

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

    return (
        <Card className="mb-6 flex flex-wrap items-end gap-4 border-gray-200 p-5 shadow-sm">
            {showPresets && (
                <div className="flex w-full flex-wrap gap-2">
                    {DATE_FILTER_PRESETS.map((preset) => {
                        const range = getDateRangeForDays(preset.days);
                        const active =
                            startDate === range.startDate && endDate === range.endDate;

                        return (
                            <button
                                key={preset.days}
                                type="button"
                                onClick={() => setPreset(preset.days)}
                                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition ${
                                    active
                                        ? "bg-brand text-white"
                                        : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                }`}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="min-w-[150px] flex-1">
                <Input
                    label="Data Inicial"
                    type="date"
                    value={startDate}
                    onChange={(event) => handleStartDateChange(event.target.value)}
                />
            </div>
            <div className="min-w-[150px] flex-1">
                <Input
                    label="Data Final"
                    type="date"
                    value={endDate}
                    onChange={(event) => handleEndDateChange(event.target.value)}
                />
            </div>
        </Card>
    );
}

"use client";

import DateRangePicker from "@/components/ui/DateRangePicker";
import { DATE_FILTER_PRESETS, type DateFilterPreset } from "@/lib/utils/dateRange";
export { getCurrentMonthRange, getDateRangeForDays, getPreviousMonthRange, DATE_FILTER_PRESETS } from "@/lib/utils/dateRange";
export type { DateRange, DateFilterPreset } from "@/lib/utils/dateRange";

export default function DateFilterBar({ startDate, endDate, onStartDateChange, onEndDateChange, showPresets = false, presets = DATE_FILTER_PRESETS }: {
    startDate: string; endDate: string; onStartDateChange: (date: string) => void; onEndDateChange: (date: string) => void;
    showPresets?: boolean; presets?: DateFilterPreset[];
}) {
    return <div className="panel-period-bar"><DateRangePicker value={{ startDate, endDate }} onChange={range => { onStartDateChange(range.startDate); onEndDateChange(range.endDate); }} presets={showPresets ? presets : []} /></div>;
}
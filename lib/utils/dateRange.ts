export type DateRange = {
    startDate: string;
    endDate: string;
};

export type DateFilterPreset = {
    label: string;
    getRange: () => DateRange;
};

export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function parseDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatRangeDate(value: string): string {
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

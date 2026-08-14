"use client";

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
    return { startDate: formatDate(start), endDate: formatDate(end) };
}

export default function DateFilterBar() {
    return null;
}

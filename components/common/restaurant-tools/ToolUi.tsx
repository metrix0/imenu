"use client";

import Input from "@/components/ui/Input";

export function numberFromInput(value: string): number {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits,
    }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
    return `${formatNumber(value, 1)}%`;
}

export function NumberField({
    label,
    value,
    onChange,
    prefix,
    suffix,
    min = 0,
    max,
    step = 0.01,
    help,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    prefix?: string;
    suffix?: string;
    min?: number;
    max?: number;
    step?: number;
    help?: string;
}) {
    return (
        <div>
            <Input
                label={label}
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step}
                value={value}
                icon={prefix || suffix}
                iconPosition={suffix ? "right" : "left"}
                onChange={(event) =>
                    onChange(numberFromInput(event.currentTarget.value))
                }
            />
            {help && <p className="mt-1.5 text-xs leading-5 text-gray-500">{help}</p>}
        </div>
    );
}

export function ResultGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function ResultItem({
    label,
    value,
    description,
    highlight = false,
    danger = false,
}: {
    label: string;
    value: string;
    description?: string;
    highlight?: boolean;
    danger?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-4 ${
                danger
                    ? "border-red-200 bg-red-50"
                    : highlight
                      ? "border-brand/30 bg-brand/5"
                      : "border-gray-200 bg-gray-50"
            }`}
        >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {label}
            </p>
            <p
                className={`mt-1 break-words text-2xl font-bold ${
                    danger ? "text-red-700" : highlight ? "text-brand" : "text-gray-950"
                }`}
            >
                {value}
            </p>
            {description && (
                <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
            )}
        </div>
    );
}

export function ToolPanel({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold text-gray-950">{title}</h2>
            {description && (
                <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            )}
            <div className="mt-6">{children}</div>
        </section>
    );
}

export function Notice({ children }: { children: React.ReactNode }) {
    return (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            {children}
        </p>
    );
}

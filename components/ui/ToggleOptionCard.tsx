"use client";

import type { ReactNode } from "react";
import Switch from "@/components/ui/Switch";

type ToggleOptionCardProps = {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: ReactNode;
    badge?: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
};

export default function ToggleOptionCard({
    label,
    checked,
    onChange,
    icon,
    badge,
    description,
    disabled = false,
    className = "",
    ariaLabel,
}: ToggleOptionCardProps) {
    return (
        <div
            data-ui="toggle-option-card"
            className={`flex min-h-[68px] items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 transition-colors ${
                checked ? "bg-brand/5" : "bg-white"
            } ${disabled ? "opacity-60" : ""} ${className}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                {icon && (
                    <span
                        className={`flex shrink-0 items-center justify-center ${
                            checked ? "text-brand" : "text-gray-500"
                        }`}
                    >
                        {icon}
                    </span>
                )}

                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800">{label}</span>
                        {badge && (
                            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                                {badge}
                            </span>
                        )}
                    </div>
                    {description && (
                        <div className="mt-0.5 text-xs text-gray-500">
                            {description}
                        </div>
                    )}
                </div>
            </div>

            <Switch
                checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                aria-label={ariaLabel || `${checked ? "Desativar" : "Ativar"} ${label}`}
            />
        </div>
    );
}

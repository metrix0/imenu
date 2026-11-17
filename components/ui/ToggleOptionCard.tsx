"use client";

import { isValidElement, type ReactNode } from "react";
import Switch from "@/components/ui/Switch";

type ToggleOptionCardProps = {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: ReactNode;
    badge?: ReactNode;
    description?: ReactNode;
    variant?: "default" | "section";
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
    variant = "default",
    disabled = false,
    className = "",
    ariaLabel,
}: ToggleOptionCardProps) {
    const isSection = variant === "section";
    const Label = isSection ? "h2" : "span";

    return (
        <div
            data-ui="toggle-option-card"
            className={`flex min-h-[68px] items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors ${disabled ? "opacity-60" : ""} ${className}`}
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
                        <Label className={isSection ? "text-xl font-semibold text-gray-900" : "font-medium text-gray-800"}>
                            {label}
                        </Label>
                        {badge &&
                            (isValidElement(badge) ? (
                                badge
                            ) : (
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                                    {badge}
                                </span>
                            ))}
                    </div>
                    {description && (
                        <div className={isSection ? "mt-1 text-sm text-gray-500" : "mt-0.5 text-xs text-gray-500"}>
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

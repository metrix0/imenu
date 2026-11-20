import { faCheck, faLock } from "@fortawesome/free-solid-svg-icons";
import * as React from "react";
import { PanelIcon } from "./PanelIcon";

export type BadgeVariant =
    | "brand"
    | "neutral"
    | "success"
    | "warning"
    | "notRecommended"
    | "info"
    | "danger"
    | "orange"
    | "purple";

export type BadgeMode = "default" | "pill" | "page";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    preset?: keyof typeof presets;
    variant?: BadgeVariant;
    mode?: BadgeMode;
    uppercase?: boolean;
};

const variants: Record<BadgeVariant, string> = {
    brand: "bg-white !text-brand ring-brand/25",
    neutral: "bg-gray-50 !text-gray-600 ring-gray-200",
    success: "bg-green-50 !text-green-700 ring-green-200",
    warning: "bg-yellow-50 !text-yellow-700 ring-yellow-200",
    notRecommended: "bg-yellow-50 !text-yellow-700 ring-yellow-200",
    info: "bg-blue-50 !text-blue-700 ring-blue-200",
    danger: "bg-red-50 !text-red-700 ring-red-200",
    orange: "bg-orange-50 !text-orange-800 ring-orange-200",
    purple: "bg-purple-50 !text-purple-700 ring-purple-200",
};

const modes: Record<BadgeMode, string> = {
    default:
        "inline-flex shrink-0 items-center align-middle rounded-full px-2 py-1 !text-[11px] leading-none font-semibold",
    pill: "inline-flex shrink-0 items-center justify-center align-middle rounded-full px-1.5 pt-[3px] pb-px !text-[9px] leading-none font-semibold tracking-wide",
    page: "inline-flex shrink-0 items-center gap-1.5 align-middle rounded-md px-2.5 py-1.5 !text-[12px] leading-none font-medium",
};

const presetBase = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium";

const presets = {
    plusIncluded: {
        variant: "orange",
        icon: faLock,
        label: "Incluso no iMenu Plus",
    },
    featureAvailable: {
        variant: "success",
        icon: faCheck,
        label: "Plano ativo",
    },
} as const;

export default function Badge({
    children,
    preset,
    variant = "brand",
    mode = "default",
    uppercase,
    className = "",
    ...props
}: BadgeProps) {
    const selectedPreset = preset ? presets[preset] : undefined;
    const style = selectedPreset ? presetBase : modes[mode];
    const badgeVariant = selectedPreset?.variant ?? variant;
    const shouldUppercase = uppercase ?? (!selectedPreset && mode === "pill");

    return (
        <span
            data-ui="badge"
            data-variant={badgeVariant}
            data-mode={selectedPreset ? undefined : mode}
            data-preset={preset}
            className={`${style} ring-1 ring-inset ${shouldUppercase ? "uppercase" : ""} ${variants[badgeVariant]} ${className}`}
            {...props}
        >
            {selectedPreset && <PanelIcon icon={selectedPreset.icon} aria-hidden="true" />}
            {children ?? selectedPreset?.label}
        </span>
    );
}

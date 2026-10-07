import * as React from "react";

export type BadgeVariant =
    | "brand"
    | "neutral"
    | "success"
    | "warning"
    | "info"
    | "danger";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    variant?: BadgeVariant;
    uppercase?: boolean;
};

const variants: Record<BadgeVariant, string> = {
    brand: "bg-white !text-brand ring-brand/25",
    neutral: "bg-gray-50 !text-gray-600 ring-gray-200",
    success: "bg-green-50 !text-green-700 ring-green-200",
    warning: "bg-yellow-50 !text-yellow-700 ring-yellow-200",
    info: "bg-blue-50 !text-blue-700 ring-blue-200",
    danger: "bg-red-50 !text-red-700 ring-red-200",
};

export default function Badge({
    children,
    variant = "brand",
    uppercase = true,
    className = "",
    ...props
}: BadgeProps) {
    return (
        <span
            data-ui="badge"
            data-variant={variant}
            className={`relative -top-[1.5px] inline-flex shrink-0 items-center align-middle rounded-full px-1.5 pt-1 pb-0.5 !text-[9px] leading-none font-semibold tracking-wide ring-1 ring-inset ${uppercase ? "uppercase" : ""} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
}

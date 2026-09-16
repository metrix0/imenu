"use client";
import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary";
    loading?: boolean;
};

export default function Button({
                                   children,
                                   variant = "primary",
                                   loading = false,
                                   className = "",
                                   ...props
                               }: ButtonProps) {
    const classTokens = className.split(/\s+/);
    const hasContextualWidth = classTokens.some((token) => /^!?w-/.test(token));
    const hasContextualHorizontalPadding = classTokens.some((token) => /^!?px-/.test(token));
    const hasContextualVerticalPadding = classTokens.some((token) => /^!?py-/.test(token));

    const base = [
        "inline-flex max-w-full min-h-7 items-center justify-center gap-1 m-0 rounded-[10px] border [font:inherit] text-center no-underline whitespace-nowrap select-none antialiased cursor-pointer shadow-none disabled:cursor-not-allowed disabled:opacity-40",
        hasContextualWidth ? "" : "w-fit",
        hasContextualHorizontalPadding ? "" : "px-2",
        hasContextualVerticalPadding ? "" : "py-0",
    ].join(" ");

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary:
            "border-transparent bg-[#1a1c1f] text-white [background-clip:padding-box] hover:bg-[color-mix(in_srgb,#1a1c1f_80%,transparent)]",
        secondary:
            "border-[rgba(26,28,31,0.118)] bg-[rgba(255,255,255,0.96)] text-[#1a1c1f] hover:bg-[color-mix(in_srgb,#1a1c1f_6%,rgba(255,255,255,0.96))]",
    };

    return (
        <button
            data-ui="button"
            data-variant={variant}
            className={`${base} ${variants[variant]} ${className} ${
                loading ? "pointer-events-none cursor-not-allowed" : "pointer-events-auto"
            }`}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? "Carregando..." : children}
        </button>
    );
}

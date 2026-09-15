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
    const hasContextualHorizontalPadding = classTokens.some((token) => /^!?px-/.test(token));
    const hasContextualVerticalPadding = classTokens.some((token) => /^!?py-/.test(token));
    const base = [
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg text-[13px] font-medium shadow-none transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d93d00] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[0.48]",
        hasContextualHorizontalPadding ? "" : "px-[14px]",
        hasContextualVerticalPadding ? "" : "py-[9px]",
    ].join(" ");
    const hasContextualSecondaryBackground =
        variant === "secondary" &&
        classTokens.some((token) => /^!?bg-(?!transparent$)/.test(token));
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: "bg-[#d93d00] text-white hover:bg-[#c43700]",
        secondary: hasContextualSecondaryBackground
            ? ""
            : "border border-[#e2e5e9] bg-white text-[#1d1d1d] hover:bg-[#f1f3f5]",
    };

    return (
        <button
            data-ui="button"
            data-variant={variant}
            className={`${base} ${variants[variant]} ${className} ${loading ? "pointer-events-none cursor-not-allowed" : "pointer-events-auto"}`}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? "Carregando..." : children}
        </button>
    );
}

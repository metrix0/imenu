"use client";
import * as React from "react";
import { usePanelAppearance } from "./PanelAppearance";

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
    const panel = usePanelAppearance();
    const classTokens = className.split(/\s+/);

    const legacyBase =
        "cursor-pointer duration-200 inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 2xl:px-6 2xl:py-3 2xl:rounded-lg";
    const legacyVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: "bg-brand hover:bg-brand/90 text-white focus:ring-brand",
        secondary:
            "bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300",
    };

    const hasContextualHorizontalPadding = classTokens.some((token) => /^!?px-/.test(token));
    const hasContextualVerticalPadding = classTokens.some((token) => /^!?py-/.test(token));
    const hasContextualSecondaryBackground =
        variant === "secondary" &&
        classTokens.some((token) => /^!?bg-(?!transparent$)/.test(token));
    const panelBase = [
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[8px] border border-[#e2e5e9] text-[13px] leading-5 font-medium shadow-none transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-[#d93d00] focus-visible:outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-[0.48]",
        hasContextualHorizontalPadding ? "" : "px-[14px]",
        hasContextualVerticalPadding ? "" : "py-[9px]",
    ].join(" ");
    const panelVariants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: "border-[#d93d00] bg-[#d93d00] text-white hover:border-[#c43700] hover:bg-[#c43700]",
        secondary: hasContextualSecondaryBackground
            ? ""
            : "border-[#e2e5e9] bg-white text-[#1d1d1d] hover:border-[#e2e5e9] hover:bg-[#f1f3f5]",
    };

    const base = panel ? panelBase : legacyBase;
    const variants = panel ? panelVariants : legacyVariants;

    return (
        <button
            data-ui="button"
            data-variant={variant}
            className={`${panel ? "" : "2xl:text-lg"} ${base} ${variants[variant]} ${className}
            ${loading ? "cursor-not-allowed pointer-events-none" : "pointer-events-auto"}
            `}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? "Carregando..." : children}
        </button>
    );
}

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
    const classTokens = className.split(/\s+/).filter(Boolean);
    const usesLegacyMenuRowSizing =
        classTokens.includes("h-auto") &&
        classTokens.includes("px-3") &&
        classTokens.includes("py-1.5") &&
        classTokens.includes("text-sm");
    const effectiveClassTokens = usesLegacyMenuRowSizing
        ? classTokens.filter(
              (token) =>
                  ![
                      "h-auto",
                      "px-3",
                      "py-1.5",
                      "text-sm",
                      "font-medium",
                      "text-gray-500",
                      "hover:border-brand",
                  ].includes(token)
          )
        : classTokens;
    const effectiveClassName = effectiveClassTokens.join(" ");
    const hasContextualHorizontalPadding = effectiveClassTokens.some((token) => /^!?px-/.test(token));
    const hasContextualVerticalPadding = effectiveClassTokens.some((token) => /^!?py-/.test(token));
    const hasContextualSecondaryBackground =
        variant === "secondary" &&
        effectiveClassTokens.some((token) => /^!?bg-(?!transparent$)/.test(token));

    const base = [
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[8px] border border-[#e2e5e9] font-[inherit] text-[13px] font-medium leading-5 shadow-none transition-[background-color,border-color,color] duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#d93d00] focus-visible:outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-[0.48]",
        hasContextualHorizontalPadding ? "" : "px-[14px]",
        hasContextualVerticalPadding ? "" : "py-[9px]",
    ].join(" ");

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: "!border-[#d93d00] bg-[#d93d00] text-white hover:!border-[#c43700] hover:bg-[#c43700]",
        secondary: hasContextualSecondaryBackground
            ? ""
            : "border-[#e2e5e9] bg-white text-[#1d1d1d] hover:border-[#e2e5e9] hover:bg-[#f1f3f5]",
    };

    return (
        <button
            data-ui="button"
            data-variant={variant}
            className={`${base} ${variants[variant]} ${effectiveClassName} ${
                loading ? "pointer-events-none cursor-not-allowed" : "pointer-events-auto"
            }`}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? "Carregando..." : children}
        </button>
    );
}

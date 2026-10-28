"use client";
import * as React from "react";
import { useParams, usePathname } from "next/navigation";

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
    const params = useParams<{ slug?: string | string[] }>();
    const pathname = usePathname();
    const routeSlug = params?.slug;
    const slug = Array.isArray(routeSlug) ? routeSlug[0] : routeSlug;
    const firstPathSegment = pathname?.split("/").filter(Boolean)[0];
    const classTokens = className.split(/\s+/).filter(Boolean);
    const hasContextualPrimaryBackground =
        variant === "primary" &&
        classTokens.some((token) => /^!?bg-(?!transparent$)/.test(token));
    const usesStorefrontMainStyles = Boolean(
        slug && firstPathSegment === slug
    );

    if (usesStorefrontMainStyles) {
        const base =
            "cursor-pointer duration-200 inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--im-menu-link,#f14400)] px-4 py-2 2xl:px-6 2xl:py-3 2xl:rounded-lg";
        const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
            primary: hasContextualPrimaryBackground
                ? "text-white focus:ring-0 focus:ring-offset-0"
                : "bg-[var(--im-menu-action,#f14400)] hover:bg-[var(--im-menu-action-hover,#f14400e6)] text-white focus:ring-[var(--im-menu-link,#f14400)]",
            secondary:
                "bg-[var(--im-menu-soft,#f3f4f6)] hover:bg-[var(--im-menu-raised,#e5e7eb)] text-[var(--im-menu-text-soft,#1f2937)] focus:ring-[var(--im-menu-border,#d1d5db)]",
        };

        return (
            <button
                data-ui="button"
                data-variant={variant}
                className={`2xl:text-lg  ${base} ${variants[variant]} ${className}
                ${loading ? "cursor-not-allowed pointer-events-none" : "pointer-events-auto"}
                `}
                disabled={loading || props.disabled}
                {...props}
            >
                {loading ? "Carregando..." : children}
            </button>
        );
    }

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
        "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[8px] border border-[#e2e5e9] font-[inherit] text-[13px] font-medium leading-5 shadow-none transition-[background-color,border-color,color] duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-[0.48]",
        hasContextualHorizontalPadding ? "" : "px-[14px]",
        hasContextualVerticalPadding ? "" : "py-[9px]",
    ].join(" ");

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: hasContextualPrimaryBackground
            ? "text-white focus-visible:outline-none"
            : "!border-[var(--im-menu-action,#d93d00)] bg-[var(--im-menu-action,#d93d00)] text-white hover:!border-[var(--im-menu-action-hover,#c43700)] hover:bg-[var(--im-menu-action-hover,#c43700)] focus-visible:outline-2 focus-visible:outline-[var(--im-menu-link,#d93d00)] focus-visible:outline-offset-[3px]",
        secondary: [
            hasContextualSecondaryBackground
                ? ""
                : "border-[var(--im-menu-border,#e2e5e9)] bg-[var(--im-menu-surface,#fff)] text-[var(--im-menu-text,#1d1d1d)] hover:border-[var(--im-menu-border,#e2e5e9)] hover:bg-[var(--im-menu-soft,#f1f3f5)]",
            "focus-visible:outline-2 focus-visible:outline-[#626973] focus-visible:outline-offset-[3px]",
        ].join(" "),
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

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
            "cursor-pointer duration-200 inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 2xl:px-6 2xl:py-3 2xl:rounded-lg";
        const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
            primary: hasContextualPrimaryBackground
                ? "focus:ring-0 focus:ring-offset-0"
                : "bg-brand hover:bg-brand/90 text-white focus:ring-brand",
            secondary:
                "bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300",
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
            ? "!border-transparent hover:!border-transparent"
            : "!border-[#d93d00] bg-[#d93d00] text-white hover:!border-[#c43700] hover:bg-[#c43700] focus-visible:outline-2 focus-visible:outline-[#d93d00] focus-visible:outline-offset-[3px]",
        secondary: [
            hasContextualSecondaryBackground
                ? ""
                : "border-[#e2e5e9] bg-white text-[#1d1d1d] hover:border-[#e2e5e9] hover:bg-[#f1f3f5]",
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

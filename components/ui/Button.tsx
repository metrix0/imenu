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
    const base =
        "cursor-pointer inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 px-4 py-2 2xl:px-6 2xl:py-3 2xl:rounded-lg";
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
        primary: "bg-brand hover:bg-brand/90 text-white focus:ring-brand",
        secondary:
            "bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300",
    };

    return (
        <button
            className={`2xl:text-lg ${base} ${variants[variant]} ${className}
            ${loading ? "cursor-not-allowed pointer-events-none" : "pointer-events-auto"}
            `}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? "Carregando..." : children}
        </button>
    );
}

"use client";
import * as React from "react";

type InputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size"
> & {
    label?: string;
    icon?: React.ReactNode; // e.g. <FontAwesomeIcon ... />
};

export default function Input({ label, icon, className = "", ...props }: InputProps) {
    const withIcon = Boolean(icon);
    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-sm font-medium">{label}</label>}
            <div className="relative">
                {withIcon && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {icon}
          </span>
                )}
                <input
                    className={`w-full border border-gray-300 rounded-md px-3 py-3 focus:ring-brand focus:border-brand  ${
                        withIcon ? "pl-10" : ""
                    } ${className}`}
                    {...props}
                />
            </div>
        </div>
    );
}

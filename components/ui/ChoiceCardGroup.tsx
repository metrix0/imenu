"use client";

import type { ReactNode } from "react";

export type ChoiceCardOption<T extends string> = {
    value: T;
    label: ReactNode;
    description?: ReactNode;
};

type ChoiceCardGroupProps<T extends string> = {
    value: T;
    options: readonly ChoiceCardOption<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
};

export default function ChoiceCardGroup<T extends string>({
    value,
    options,
    onChange,
    disabled = false,
    className = "",
    "aria-label": ariaLabel,
}: ChoiceCardGroupProps<T>) {
    return (
        <div role="group" aria-label={ariaLabel} className={`grid grid-cols-1 gap-3 ${className}`}>
            {options.map((option) => {
                const selected = value === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        data-ui="choice"
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => onChange(option.value)}
                        className={`cursor-pointer rounded-[8px] border p-4 text-left transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                            selected
                                ? "border-[#d93d00] bg-[#fff1ea]"
                                : "border-[#e2e5e9] bg-white hover:bg-[#f1f3f5]"
                        }`}
                    >
                        <span className={`block font-medium ${selected ? "text-[#c43700]" : "text-[#1d1d1d]"}`}>
                            {option.label}
                        </span>
                        {option.description != null && (
                            <span className="mt-1 block text-sm text-[#626973]">
                                {option.description}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

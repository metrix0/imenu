"use client";

import * as React from "react";

type InputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size"
> & {
    label?: string;
    icon?: React.ReactNode | string;
    iconPosition?: "left" | "right";
    numeric?: boolean;
    float?: boolean;
    locked?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            icon,
            iconPosition = "left",
            numeric = false,
            float = false,
            className = "",
            locked = false,
            defaultValue: providedDefaultValue,
            value,
            onInput,
            onKeyDown,
            type = "text",
            inputMode,
            ...inputProps
        },
        ref
    ) => {
        const withIcon = Boolean(icon);
        const isLeft = iconPosition === "left";

        const formatToFloat = (raw: string) => {
            let digits = raw.replace(/\D/g, "");

            if (digits.length === 0) return "0,00";
            if (digits.length === 1) digits = `00${digits}`;
            if (digits.length === 2) digits = `0${digits}`;

            const intPart = digits.slice(0, digits.length - 2);
            const decPart = digits.slice(digits.length - 2);

            return `${intPart},${decPart}`;
        };

        const handleInput = (
            event: React.FormEvent<HTMLInputElement>
        ) => {
            if (float) {
                event.currentTarget.value = formatToFloat(
                    event.currentTarget.value
                );
            }

            onInput?.(event);
        };

        const handleKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>
        ) => {
            if (numeric || float) {
                const key = event.key;
                const allowedKeys = [
                    "Backspace",
                    "Delete",
                    "Tab",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                ];

                if (
                    !allowedKeys.includes(key) &&
                    !/^[0-9]$/.test(key)
                ) {
                    event.preventDefault();
                }
            }

            onKeyDown?.(event);
        };

        const defaultValue =
            float &&
            (providedDefaultValue === undefined ||
                providedDefaultValue === null ||
                providedDefaultValue === "" ||
                providedDefaultValue === "0" ||
                providedDefaultValue === 0)
                ? "0,00"
                : providedDefaultValue;

        const isControlled =
            value !== undefined && value !== null;

        return (
            <div className="flex flex-col gap-1 2xl:gap-2">
                {label && (
                    <label className="text-sm font-medium md:text-xs 2xl:text-base">
                        {label}
                    </label>
                )}

                <div className="relative">
                    {withIcon && (
                        <span
                            className={`absolute top-1/2 -translate-y-1/2 text-gray-500 ${
                                isLeft ? "left-3" : "right-3"
                            }`}
                        >
                            {icon}
                        </span>
                    )}

                    <input
                        {...inputProps}
                        ref={ref}
                        type={type}
                        inputMode={
                            numeric || float
                                ? "numeric"
                                : inputMode
                        }
                        onKeyDown={handleKeyDown}
                        onInput={handleInput}
                        {...(isControlled
                            ? { value }
                            : { defaultValue })}
                        className={`w-full border border-gray-300 rounded-md px-3 py-3
                            focus:ring-brand focus:border-brand 2xl:text-lg
                            ${
                                withIcon
                                    ? isLeft
                                        ? "pl-10"
                                        : "pr-10"
                                    : ""
                            }
                            ${className}
                            ${
                                locked
                                    ? "bg-gray-100 cursor-not-allowed text-gray-500"
                                    : "bg-white"
                            }
                        `}
                    />
                </div>
            </div>
        );
    }
);

Input.displayName = "Input";

export default Input;

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
    inline?: boolean;
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
            inline = false,
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
        const generatedId = React.useId();
        const inputId = inputProps.id ?? generatedId;
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

        if (inline) {
            return <input {...inputProps} data-ui="input" ref={ref} type={type}
                inputMode={numeric || float ? "numeric" : inputMode}
                onKeyDown={handleKeyDown} onInput={handleInput}
                {...(isControlled ? { value } : { defaultValue })}
                className={className} />;
        }

        return (
            <div data-ui="field" className="flex min-w-0 flex-col gap-1.5">
                {label && (
                    <label data-ui="field-label" htmlFor={inputId} className="text-xs font-medium leading-[18px] text-[#1d1d1d]">
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
                        data-ui="input"
                        {...inputProps}
                        id={inputId}
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
                        className={`min-h-11 w-full rounded-lg border border-[#e2e5e9] px-3 py-[11px] text-sm leading-5 text-[#1d1d1d] outline-none shadow-none transition-colors placeholder:text-[#818994] focus:border-[#d93d00] focus:ring-1 focus:ring-[#d93d00] disabled:cursor-not-allowed disabled:bg-[#f1f3f5] disabled:text-[#626973] aria-[invalid=true]:border-[#be2626]
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
                                    ? "cursor-not-allowed bg-[#f1f3f5] text-[#626973]"
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

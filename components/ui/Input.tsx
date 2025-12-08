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
};

const Input = React.forwardRef<HTMLInputElement, InputProps>((
    {
        label,
        icon,
        iconPosition = "left",
        numeric = false,
        float = false,
        className = "",
        ...props
    },
    ref
) => {
    const withIcon = Boolean(icon);
    const isLeft = iconPosition === "left";

    const formatToFloat = (raw: string) => {
        let digits = raw.replace(/\D/g, "");

        if (digits.length === 0) return "0,00";
        if (digits.length === 1) digits = "00" + digits;
        if (digits.length === 2) digits = "0" + digits;

        const intPart = digits.slice(0, digits.length - 2);
        const decPart = digits.slice(digits.length - 2);

        return `${intPart},${decPart}`;
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
        if (!float) return;
        const raw = e.currentTarget.value;
        const formatted = formatToFloat(raw);
        e.currentTarget.value = formatted;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!numeric && !float) return;

        const key = e.key;

        if (["Backspace", "Tab", "ArrowLeft", "ArrowRight"].includes(key)) return;

        if (!/^[0-9]$/.test(key)) {
            e.preventDefault();
        }
    };

    const defaultValue =
        float &&
        (props.defaultValue === undefined ||
            props.defaultValue === null ||
            props.defaultValue === "" ||
            props.defaultValue === "0" ||
            props.defaultValue === 0)
            ? "0,00"
            : props.defaultValue;

    return (
        <div className="flex flex-col gap-1 2xl:gap-2">
            {label && <label className="text-sm font-medium md:text-xs 2xl:text-base">{label}</label>}

            <div className="relative">
                {withIcon && (
                    <span
                        className={`absolute top-1/2 -translate-y-1/2 text-gray-500
              ${isLeft ? "left-3" : "right-3"}`}
                    >
                        {icon}
                    </span>
                )}

                <input
                    ref={ref}                      // <-- REQUIRED FIX
                    type="text"
                    inputMode={numeric || float ? "numeric" : props.inputMode}
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    defaultValue={defaultValue}
                    {...props}
                    className={`w-full border border-gray-300 rounded-md px-3 py-3
                        focus:ring-brand focus:border-brand 2xl:text-lg
                        ${withIcon ? (isLeft ? "pl-10" : "pr-10") : ""}
                        ${className}`}
                />
            </div>
        </div>
    );
});

export default Input;

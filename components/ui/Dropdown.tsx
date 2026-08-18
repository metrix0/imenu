"use client";
import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

export type DropdownOption = {
    value: string | number;
    label: string;
};

type DropdownProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    options: DropdownOption[];
    chevronClassName?: string;
};

const Dropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(function Dropdown(
    {
        label,
        options,
        className = "",
        chevronClassName,
        ...props
    },
    ref
) {
    const [open, setOpen] = React.useState(false);
    const selectRef = React.useRef<HTMLSelectElement>(null);

    React.useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

    const handleToggle = () => {
        setOpen((prev) => !prev);
        selectRef.current?.focus();
    };

    return (
        <div className="flex flex-col gap-1 2xl:gap-2">
            {label && <label className="text-xs font-medium 2xl:text-base">{label}</label>}

            <div
                className="relative inline-block w-full cursor-pointer"
                onClick={handleToggle}
            >
                <select
                    ref={selectRef}
                    className={`w-full appearance-none border border-gray-300 rounded-md px-3 py-3 pr-9 bg-white text-gray-900 outline-none transition-all duration-150 cursor-pointer 2xl:rounded-lg 2xl:px-4 2xl:py-4 2xl:pr-11 2xl:text-lg ${className}`}
                    onBlur={() => setOpen(false)}
                    {...props}
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>

                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform duration-200 pointer-events-none 2xl:right-4 2xl:text-lg ${
                        open ? "rotate-180" : ""
                    } ${chevronClassName || ""}`}
                />
            </div>
        </div>
    );
});

export default Dropdown;

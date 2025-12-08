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
};

export default function Dropdown({
                                     label,
                                     options,
                                     className = "",
                                     ...props
                                 }: DropdownProps) {
    const [open, setOpen] = React.useState(false);
    const selectRef = React.useRef<HTMLSelectElement>(null);

    const handleToggle = () => {
        setOpen((prev) => !prev);
        selectRef.current?.focus(); // ensures click on chevron opens it too
    };

    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-sm font-medium 2xl:text-base">{label}</label>}

            <div
                className="relative inline-block w-full cursor-pointer"
                onClick={handleToggle}
            >
                <select
                    ref={selectRef}
                    className={`w-full appearance-none border border-gray-300 rounded-md px-3 py-3 pr-9 bg-white text-gray-900 outline-none transition-all duration-150 cursor-pointer ${className}`}
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
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-transform duration-200 pointer-events-none ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </div>
        </div>
    );
}

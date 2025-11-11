"use client";
import * as React from "react";

type ToggleInputProps = {
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label?: string;
    className?: string;
};

export default function ToggleInput({
                                        checked,
                                        onChange,
                                        label,
                                        className = "",
                                    }: ToggleInputProps) {
    return (
        <label className={`flex items-center gap-2 cursor-pointer ${className}`}>
            <div
                className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ${
                    checked ? "bg-brand" : "bg-gray-300"
                }`}
            >
                <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${
                        checked ? "translate-x-4" : ""
                    }`}
                />
            </div>
            {label && <span>{label}</span>}
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="hidden"
            />
        </label>
    );
}

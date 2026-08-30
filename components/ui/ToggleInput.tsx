"use client";
import * as React from "react";

type ToggleInputProps = {
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label?: any;
    className?: string;
    color?: string | null;
};

export default function ToggleInput({
                                        checked,
                                        onChange,
                                        label,
                                        className = "",
                                    }: ToggleInputProps) {
    return (
        <label className={`flex items-center gap-2 cursor-pointer 2xl:gap-3 ${className}`}>
            <div
                className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 2xl:w-12 2xl:h-7 ${
                    checked ? "bg-green-500" : "bg-gray-300"
                }`}
            >
                <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 2xl:w-5 2xl:h-5 ${
                        checked ? "translate-x-4 2xl:translate-x-5" : ""
                    }`}
                />
            </div>
            {label && <span className={"text-sm 2xl:text-base"}>{label}</span>}
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="hidden"
            />
        </label>
    );
}
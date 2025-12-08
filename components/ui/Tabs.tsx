"use client";
import * as React from "react";

type TabsProps<T extends string = string> = {
    tabs: T[];
    active: T;
    onChange: (tab: T) => void;
    className?: string;
    childClassName?: string;
};

export default function Tabs<T extends string>({
                                                   tabs,
                                                   active,
                                                   onChange,
                                                   className = "",
                                                    childClassName= "",
                                               }: TabsProps<T>) {
    return (
        <div className={`flex gap-2 border-b border-gray-200 ${className}`}>
            {tabs.map((tab) => (
                <button
                    key={tab}
                    onClick={() => onChange(tab)}
                    className={`px-4 py-2 2xl:py-3 2xl:px-5 font-medium border-b-2 transition-all cursor-pointer 2xl:text-[1.18rem] ${childClassName} ${
                        active === tab
                            ? "border-brand text-brand"
                            : "border-transparent text-gray-600 hover:text-gray-800"
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>
    );
}

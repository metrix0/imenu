"use client";

import type { ButtonHTMLAttributes } from "react";

export default function Switch({ checked, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean | "mixed" }) {
    return <button {...props} type="button" role="switch" aria-checked={checked} data-ui="switch" className={`relative h-[22px] w-[38px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50 ${checked === "mixed" ? "bg-amber-400" : checked ? "bg-green-500" : "bg-gray-300"} ${className}`}><span className="block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: `translateX(${checked === "mixed" ? 8 : checked ? 16 : 0}px)` }} /></button>;
}

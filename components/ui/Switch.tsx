"use client";

import type { ButtonHTMLAttributes } from "react";

export default function Switch({ checked, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean | "mixed" }) {
    return <button {...props} type="button" role="switch" aria-checked={checked} data-ui="switch" className={`relative flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full p-[3px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${checked === "mixed" ? "bg-[#e8b546]" : checked ? "bg-[#22a867]" : "bg-[#cbd0d6]"} ${className}`}><span className="block h-4 w-4 rounded-full bg-white transition-transform duration-150" style={{ transform: `translateX(${checked === "mixed" ? 8 : checked ? 16 : 0}px)` }} /></button>;
}

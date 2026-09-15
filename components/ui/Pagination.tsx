"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageCount, onChange, disabled = false }: {
    page: number; pageCount: number; onChange: (page: number) => void; disabled?: boolean;
}) {
    const total = Math.max(1, pageCount);
    const pages = Array.from(new Set([0, page - 1, page, page + 1, total - 1]))
        .filter(value => value >= 0 && value < total).sort((a, b) => a - b);
    const buttonClass = "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#e2e5e9] bg-white text-[13px] transition-colors hover:bg-[#f1f3f5] disabled:cursor-not-allowed disabled:opacity-40 max-md:w-8";
    return <nav data-ui="pagination" aria-label="Paginação" className="flex items-center justify-center gap-1 pt-5 max-md:gap-0.5">
        <button className={buttonClass} type="button" aria-label="Página anterior" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
        {pages.map((value, index) => <span key={value} className="inline-flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <button className={`${buttonClass} ${page === value ? "border-[#f6c9b6] bg-[#fff1ea] text-[#c43700] hover:bg-[#fff1ea]" : ""}`} type="button" aria-label={`Página ${value + 1}`} aria-current={page === value ? "page" : undefined}
                disabled={disabled} onClick={() => onChange(value)}>{value + 1}</button>
        </span>)}
        <button className={buttonClass} type="button" aria-label="Próxima página" disabled={disabled || page >= total - 1} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
    </nav>;
}

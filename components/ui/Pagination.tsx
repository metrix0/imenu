"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageCount, onChange, disabled = false }: {
    page: number; pageCount: number; onChange: (page: number) => void; disabled?: boolean;
}) {
    const total = Math.max(1, pageCount);
    const pages = Array.from(new Set([0, page - 1, page, page + 1, total - 1]))
        .filter(value => value >= 0 && value < total).sort((a, b) => a - b);
    return <nav data-ui="pagination" aria-label="Paginação">
        <button type="button" aria-label="Página anterior" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
        {pages.map((value, index) => <span key={value} className="inline-flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <button type="button" aria-label={`Página ${value + 1}`} aria-current={page === value ? "page" : undefined}
                disabled={disabled} onClick={() => onChange(value)}>{value + 1}</button>
        </span>)}
        <button type="button" aria-label="Próxima página" disabled={disabled || page >= total - 1} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
    </nav>;
}

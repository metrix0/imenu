"use client";

import type { ReactNode } from "react";
import ListLoader from "./ListLoader";

export type TableColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

export default function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, emptyMessage = "Nenhum resultado encontrado." }: {
    columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T) => string;
    onRowClick?: (row: T) => void; loading?: boolean; emptyMessage?: string;
}) {
    return <div data-ui="table" className="overflow-x-auto rounded-[10px] border border-[#e2e5e9] bg-white">
        <table className="w-full text-left text-[13px] tabular-nums [&_tbody_tr:last-child_td]:border-b-0"><thead className="bg-[#f7f8fa] text-[#626973]"><tr>{columns.map(column => <th key={column.key} className={`px-4 py-3.5 font-medium normal-case tracking-normal ${column.className ?? ""}`}>{column.label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={columns.length} className="border-b border-[#e2e5e9] px-4 py-3.5"><ListLoader lines={6} /></td></tr> : rows.length === 0
                ? <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">{emptyMessage}</td></tr>
                : rows.map(row => <tr key={rowKey(row)} tabIndex={onRowClick ? 0 : undefined} className={`transition-colors hover:bg-[#f7f8fa] ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)} onKeyDown={event => { if (event.target === event.currentTarget && onRowClick && ["Enter", " "].includes(event.key)) { event.preventDefault(); onRowClick(row); } }}>
                    {columns.map(column => <td key={column.key} className={`border-b border-[#e2e5e9] px-4 py-3.5 ${column.className ?? ""}`}>{column.render(row)}</td>)}
                </tr>)}</tbody>
        </table>
    </div>;
}

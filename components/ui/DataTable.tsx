"use client";

import type { ReactNode } from "react";
import ListLoader from "./ListLoader";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";

export type TableColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string; sortable?: boolean };

export default function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, emptyMessage = "Nenhum resultado encontrado.", sortKey, sortDirection = "desc", onSort }: {
    columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T) => string;
    onRowClick?: (row: T) => void; loading?: boolean; emptyMessage?: ReactNode;
    sortKey?: string; sortDirection?: "asc" | "desc"; onSort?: (key: string) => void;
}) {
    return <div data-ui="table" className="overflow-x-auto rounded-[10px] border border-[#e2e5e9] bg-white">
        <table className="w-full text-left text-[13px] tabular-nums [&_tbody_tr:last-child_td]:border-b-0"><thead className="bg-[#f7f8fa] text-[#626973]"><tr>{columns.map(column => (
            <th key={column.key}
                aria-sort={column.sortable && onSort && sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                className={`px-4 py-3.5 font-medium normal-case tracking-normal ${column.className ?? ""}`}>
                {column.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(column.key)}
                        title={`Ordenar por ${column.label}`}
                        className="group inline-flex cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-[#1d1d1d] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d93d00]">
                        <span>{column.label}</span>
                        {sortKey === column.key
                            ? sortDirection === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />
                            : <ArrowUpDown size={13} aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />}
                    </button>
                ) : column.label}
            </th>
        ))}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={columns.length} className="border-b border-[#e2e5e9] px-4 py-3.5"><ListLoader lines={6} /></td></tr> : rows.length === 0
                ? <tr>
                    <td colSpan={columns.length} className="px-4 py-0 text-center">
                        <div className="flex min-h-[224px] flex-col items-center justify-center gap-4 px-4 py-10 sm:min-h-[240px]">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-[#e2e5e9] bg-[#f7f8fa]">
                                <Inbox size={26} strokeWidth={1.5} className="text-[#818994]" aria-hidden="true" />
                            </div>
                            <div className="max-w-lg text-sm font-medium leading-6 text-[#626973]">{emptyMessage}</div>
                        </div>
                    </td>
                </tr>
                : rows.map(row => <tr key={rowKey(row)} tabIndex={onRowClick ? 0 : undefined} className={`transition-colors hover:bg-[#f7f8fa] ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)} onKeyDown={event => { if (event.target === event.currentTarget && onRowClick && ["Enter", " "].includes(event.key)) { event.preventDefault(); onRowClick(row); } }}>
                    {columns.map(column => <td key={column.key} className={`border-b border-[#e2e5e9] px-4 py-3.5 ${column.className ?? ""}`}>{column.render(row)}</td>)}
                </tr>)}</tbody>
        </table>
    </div>;
}

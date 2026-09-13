"use client";

import type { ReactNode } from "react";
import ListLoader from "./ListLoader";

export type TableColumn<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

export default function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, emptyMessage = "Nenhum resultado encontrado." }: {
    columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T) => string;
    onRowClick?: (row: T) => void; loading?: boolean; emptyMessage?: string;
}) {
    return <div data-ui="table" className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left"><thead><tr>{columns.map(column => <th key={column.key} className={column.className}>{column.label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={columns.length}><ListLoader lines={6} /></td></tr> : rows.length === 0
                ? <tr><td colSpan={columns.length} className="py-12 text-center text-gray-500">{emptyMessage}</td></tr>
                : rows.map(row => <tr key={rowKey(row)} tabIndex={onRowClick ? 0 : undefined} className={onRowClick ? "cursor-pointer" : undefined}
                    onClick={() => onRowClick?.(row)} onKeyDown={event => { if (event.target === event.currentTarget && onRowClick && ["Enter", " "].includes(event.key)) { event.preventDefault(); onRowClick(row); } }}>
                    {columns.map(column => <td key={column.key} className={column.className}>{column.render(row)}</td>)}
                </tr>)}</tbody>
        </table>
    </div>;
}

"use client";

import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";

export type PageData<T> = { rows: T[]; total: number; page: number; pageCount: number };

export default function PagedTable<T>({ data, columns, rowKey, onPage, onRowClick, loading, sortKey, sortDirection, onSort }: {
    data: PageData<T>; columns: TableColumn<T>[]; rowKey: (row: T) => string;
    onPage: (page: number) => void; onRowClick?: (row: T) => void; loading?: boolean; pageSize?: number;
    sortKey?: string; sortDirection?: "asc" | "desc"; onSort?: (key: string) => void;
}) {
    return <div><DataTable rows={data.rows} columns={columns} rowKey={rowKey} onRowClick={onRowClick} loading={loading}
            sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
        {data.pageCount > 1 && <Pagination page={data.page} pageCount={data.pageCount} onChange={onPage} disabled={loading} />}
    </div>;
}

"use client";

import styles from "./dashboard.module.css";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";

export type PageData<T> = { rows: T[]; total: number; page: number; pageCount: number };

export default function PagedTable<T>({ data, columns, rowKey, onPage, onRowClick, loading, pageSize = 25 }: {
    data: PageData<T>; columns: TableColumn<T>[]; rowKey: (row: T) => string;
    onPage: (page: number) => void; onRowClick?: (row: T) => void; loading?: boolean; pageSize?: number;
}) {
    return <div><DataTable rows={data.rows} columns={columns} rowKey={rowKey} onRowClick={onRowClick} loading={loading} />
        {data.total > 0 && <div className={styles.tableFooter}><span>{`${data.page*pageSize+1}–${Math.min((data.page+1)*pageSize,data.total)} de ${data.total}`}</span>{data.pageCount>1 && <Pagination page={data.page} pageCount={data.pageCount} onChange={onPage} disabled={loading}/>}</div>}
    </div>;
}

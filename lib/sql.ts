import { pool } from "./db";

export async function query<T = any>(
    text: string,
    params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {   // <-- add rowCount to the return type
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return {
            rows: res.rows as T[],
            rowCount: res.rowCount ?? 0   // <-- return rowCount too
        };
    } finally {
        client.release();
    }
}
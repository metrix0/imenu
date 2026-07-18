import type { PoolClient } from "pg";
import { pool } from "./db";

export async function query<T = any>(
    text: string,
    params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
    const client = await pool.connect();

    try {
        const result = await client.query(text, params);

        return {
            rows: result.rows as T[],
            rowCount: result.rowCount ?? 0,
        };
    } finally {
        client.release();
    }
}

export async function withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("[DATABASE] Transaction rollback failed:", rollbackError);
        }

        throw error;
    } finally {
        client.release();
    }
}

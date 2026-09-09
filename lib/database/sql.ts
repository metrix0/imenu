import type { PoolClient } from "pg";
import { pool } from "./db";

const advisoryLockQueues = new Map<string, Promise<void>>();

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

export async function withAdvisoryLock<T>(
    key: string,
    callback: () => Promise<T>
): Promise<T> {
    const previous = advisoryLockQueues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);

    advisoryLockQueues.set(key, tail);
    await previous.catch(() => undefined);

    try {
        return await callback();
    } finally {
        release();
        if (advisoryLockQueues.get(key) === tail) {
            advisoryLockQueues.delete(key);
        }
    }
}

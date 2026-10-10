import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
});

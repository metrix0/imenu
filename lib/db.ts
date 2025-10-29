import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // modest; pooler sits in front
    ssl: { rejectUnauthorized: false },
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

// Runs against an isolated PostgreSQL service in CI, never a production database.
// Without CHECKOUT_TEST_DATABASE_URL this suite is skipped in local Jest runs.
const checkoutDb = process.env.CHECKOUT_TEST_DATABASE_URL;
const integrationTest = checkoutDb ? test : test.skip;

integrationTest("AI-credit migration permits exact-cent checkout prices in PostgreSQL", async () => {
  const parsed = new URL(checkoutDb!);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/ci") {
    throw new Error("Checkout integration tests require a local disposable 'ci' database.");
  }

  const client = new Client({ connectionString: checkoutDb });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Reproduce the pre-fix production constraint, which rejected R$1.64.
    await client.query(`
      CREATE TABLE public.ia_vendas_credit_purchases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id uuid NOT NULL,
        client_request_id uuid NOT NULL,
        input_tokens bigint NOT NULL,
        output_tokens bigint NOT NULL,
        image_count integer NOT NULL,
        price_cents integer NOT NULL,
        usd_brl_rate numeric NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        CONSTRAINT ia_vendas_credit_purchases_price_cents_check
          CHECK (price_cents >= 50 AND price_cents % 50 = 0)
      )
    `);

    const insert = `
      INSERT INTO public.ia_vendas_credit_purchases
        (restaurant_id, client_request_id, input_tokens, output_tokens,
         image_count, price_cents, usd_brl_rate)
      VALUES ('30000000-0000-4000-8000-000000000001',
        gen_random_uuid(), 1000000, 60000, 0, $1, 6)
      RETURNING price_cents, status
    `;

    await client.query("SAVEPOINT old_constraint");
    await expect(client.query(insert, [164])).rejects.toMatchObject({ code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT old_constraint");

    const migration = readFileSync(
      resolve(process.cwd(), "scripts/sql/20261106_allow_exact_cent_ai_credit_purchases.sql"),
      "utf8",
    );
    await client.query(migration);

    for (const cents of [164, 181, 579]) {
      const result = await client.query(insert, [cents]);
      expect(result.rows[0]).toEqual({ price_cents: cents, status: "pending" });
    }

    // Invalid zero/negative prices remain blocked.
    await client.query("SAVEPOINT invalid_price");
    await expect(client.query(insert, [0])).rejects.toMatchObject({ code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT invalid_price");

    const constraint = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.ia_vendas_credit_purchases'::regclass
        AND conname = 'ia_vendas_credit_purchases_price_cents_check'
    `);
    expect(constraint.rows[0].definition).toBe("CHECK ((price_cents >= 1))");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});

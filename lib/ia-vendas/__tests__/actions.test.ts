import { propose, execute, apply } from "../actions";
import { query, withTransaction } from "@/lib/database/sql";
import { metrics } from "../data";
import { IaPlusRequired } from "../access";
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("../data", () => ({
  metrics: jest.fn(),
  window28: () => ({ start: "2026-01-01", end: "2026-01-29" }),
}));
const restaurant = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
let calls: { sql: string; params: any[] }[], current: any, action: any, plus: boolean, used: boolean;
const c = {
  query: jest.fn(async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("restaurant_addons")) return { rows: plus ? [{ status: "active" }] : [] };
    if (sql.includes("SELECT EXISTS")) return { rows: [{ used }] };
    if (sql.startsWith("SELECT kind")) return { rows: [{ kind: "chat" }] };
    if (sql.includes("SELECT t.*"))
      return {
        rows: current ? [structuredClone(current)] : [],
        rowCount: current ? 1 : 0,
      };
    if (sql.includes("SELECT * FROM public.ia_vendas_actions"))
      return { rows: [{ ...structuredClone(action), id: params[1] }] };
    if (sql.includes("count(*) n")) return { rows: [{ n: 0 }] };
    if (sql.includes("INSERT INTO public.ia_vendas_actions"))
      return {
        rows: [{ operations: JSON.parse(params[5]), status: "pending" }],
      };
    if (sql.includes("UPDATE public.items"))
      return { rows: [{ ...current, price_cents: params[2] }] };
    if (sql.includes("UPDATE public.ia_vendas_actions")) {
      if (params[2] === "applied") used = true;
      return {
        rows: [
          { ...action, status: params[2], operations: JSON.parse(params[3]) },
        ],
      };
    }
    return { rows: [], rowCount: 0 };
  }),
};
beforeEach(() => {
  calls = [];
  plus = true;
  used = false;
  current = {
    id,
    restaurant_id: restaurant,
    name: "Temaki",
    price_cents: 1000,
    description: "untouched",
  };
  action = {
    id,
    restaurant_id: restaurant,
    conversation_id: restaurant,
    status: "applying",
    operations: [
      {
        entity: "items",
        kind: "update",
        id,
        label: "Temaki",
        values: { price_cents: 999 },
        before: { price_cents: 1000 },
      },
    ],
  };
  (withTransaction as jest.Mock).mockImplementation(async (fn) => fn(c));
  (metrics as jest.Mock).mockResolvedValue({ orders: 10, products: [] });
});
test("failed application leaves the free application available", async () => {
  plus = false;
  current.price_cents = 1200;
  await expect(execute(restaurant, id, false)).rejects.toThrow("registro mudou");
  expect(used).toBe(false);
  current.price_cents = 1000;
  await expect(execute(restaurant, id, false)).resolves.toMatchObject({ status: "applied" });
  expect(used).toBe(true);
});
test("concurrent free applications recheck the allowance after the transaction lock", async () => {
  plus = false;
  let queue = Promise.resolve();
  (withTransaction as jest.Mock).mockImplementation((fn) => {
    const next = queue.then(() => fn(c));
    queue = next.catch(() => undefined);
    return next;
  });
  const results = await Promise.allSettled([
    execute(restaurant, id, false),
    execute(restaurant, "33333333-3333-4333-8333-333333333333", false),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(IaPlusRequired);
  expect(calls.filter((r) => r.sql.includes("UPDATE public.items"))).toHaveLength(1);
  const lock = calls.findIndex((r) => r.sql.includes("pg_advisory_xact_lock"));
  const allowance = calls.findIndex((r) => r.sql.includes("SELECT EXISTS"));
  expect(allowance).toBeGreaterThan(lock);
});
test("an applied proposal remains idempotent even after the free allowance was used", async () => {
  plus = false;
  used = true;
  action.status = "applied";
  await expect(execute(restaurant, id, false)).resolves.toMatchObject({ status: "applied" });
  expect(calls.some((r) => r.sql.includes("UPDATE public.items"))).toBe(false);
});
test("proposing never writes business tables", async () => {
  const p = await propose(restaurant, id, id, {
    title: "Preço",
    reason: "Arredondamento",
    operations: [
      { entity: "items", kind: "update", id, values: { price_cents: 999 } },
    ],
  });
  expect(p.status).toBe("pending");
  expect(p.operations[0].before).toEqual({ price_cents: 1000 });
  expect(
    calls.some((x) =>
      /^(UPDATE|INSERT INTO|DELETE FROM) public.items/.test(x.sql),
    ),
  ).toBe(false);
});
test("foreign or nonexistent item cannot be proposed", async () => {
  current = null;
  await expect(
    propose(restaurant, id, id, {
      title: "Preço",
      reason: "test",
      operations: [
        { entity: "items", kind: "update", id, values: { price_cents: 999 } },
      ],
    }),
  ).rejects.toThrow("Registro não encontrado");
  expect(calls.find((x) => x.sql.includes("SELECT t.*"))?.params[0]).toBe(
    restaurant,
  );
});
test("changed fields conflict before any mutation", async () => {
  current.price_cents = 1200;
  await expect(execute(restaurant, id, false)).rejects.toThrow(
    "registro mudou",
  );
  expect(calls.some((x) => x.sql.includes("UPDATE public.items"))).toBe(false);
});
test("apply records before/after and captures a baseline", async () => {
  const result = await execute(restaurant, id, false);
  expect(result.status).toBe("applied");
  expect(result.operations[0].before).toEqual({ price_cents: 1000 });
  expect(result.operations[0].after).toEqual({ price_cents: 999 });
  expect(metrics).toHaveBeenCalled();
});
test("undo preserves independently changed fields", async () => {
  action.status = "applied";
  action.operations[0].after = { price_cents: 999 };
  current.price_cents = 999;
  current.description = "owner edit";
  const result = await execute(restaurant, id, true);
  expect(result.status).toBe("undone");
  const write = calls.find((x) => x.sql.includes("UPDATE public.items"))!;
  expect(write.sql).not.toContain("description");
  expect(write.params).toEqual([restaurant, id, 1000]);
});
test("undo rejects a newer price change", async () => {
  action.status = "applied";
  action.operations[0].after = { price_cents: 999 };
  current.price_cents = 1300;
  await expect(execute(restaurant, id, true)).rejects.toThrow("registro mudou");
});
test("automatic database retry stops after the single retry", async () => {
  let attempts = 0;
  (query as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql.includes("SET status='applying'"))
      return { rows: [{ ...action, attempts: ++attempts }] };
    if (sql.startsWith("SELECT"))
      return { rows: [{ ...action, status: "failed" }] };
    return { rows: [] };
  });
  (withTransaction as jest.Mock).mockRejectedValue(
    Object.assign(new Error("serialization"), { code: "40001" }),
  );
  await expect(apply(restaurant, id)).rejects.toThrow("serialization");
  expect(attempts).toBe(2);
});

test('numeric discount snapshots normalize PostgreSQL decimal strings', async () => {
  current = { id, restaurant_id: restaurant, type: 'percent', value: '10.00', active: true };
  const proposal = await propose(restaurant, id, id, {title:'Desconto', reason:'Revisão', operations:[{entity:'promotions',kind:'update',id,values:{value:15}}]});
  expect(proposal.operations[0].before).toEqual({value:10});
});

test('undo restores numeric discounts returned as strings by PostgreSQL', async () => {
  current = { id, restaurant_id: restaurant, type: 'percent', value: '15.00', active: true };
  action.status = 'applied';
  action.operations = [{entity:'promotions',kind:'update',id,label:'Desconto',values:{value:15},before:{value:10},after:{value:15}}];
  const result = await execute(restaurant,id,true);
  expect(result.status).toBe('undone');
  expect(calls.find(x=>x.sql.includes('UPDATE public.promotions'))?.params).toEqual([restaurant,id,10]);
});

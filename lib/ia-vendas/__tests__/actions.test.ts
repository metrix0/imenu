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

test("automatic upsell can be proposed as a reversible singleton update", async () => {
  current = { restaurant_id: restaurant, enabled: false };
  const proposal = await propose(restaurant, id, id, {
    title: "Habilitar Upsell Automático", reason: "Recomendações automáticas",
    operations: [{ entity: "automatic_upsell", kind: "update", id: restaurant, values: { enabled: true } }],
  });
  expect(proposal.operations[0].before).toEqual({ enabled: false });
  expect(calls.some(({sql}) => sql.includes("UPDATE public.automatic_upsell"))).toBe(false);
  action.operations = proposal.operations;
  await execute(restaurant, id, false);
  expect(calls.some(({sql,params}) => sql.includes("UPDATE public.automatic_upsell") && params[0] === restaurant && params[1] === restaurant)).toBe(true);
});

test("automatic upsell cannot be enabled by AI without iMenu Plus", async () => {
  plus = false;
  current = { restaurant_id: restaurant, enabled: false };
  action.operations = [{
    entity: "automatic_upsell", kind: "update", id: restaurant,
    label: "Upsell Automático", values: { enabled: true },
    before: { enabled: false },
  }];
  await expect(execute(restaurant, id, false)).rejects.toThrow("iMenu Plus");
  expect(calls.some(({ sql }) => sql.includes("UPDATE public.automatic_upsell"))).toBe(false);
});

test("marketing cannot be enabled by AI without iMenu Plus", async () => {
  plus = false;
  const { DEFAULT_AUTOMATIONS } = await import("@/lib/services/crmRules");
  const settings = { ...DEFAULT_AUTOMATIONS, cart: { ...DEFAULT_AUTOMATIONS.cart, enabled: true } };
  current = { restaurant_id: restaurant, automations: DEFAULT_AUTOMATIONS };
  action.operations = [{
    entity: "whatsapp_bot_settings", kind: "update", id: restaurant,
    label: "Marketing", values: { automations: settings },
    before: { automations: DEFAULT_AUTOMATIONS },
  }];
  await expect(execute(restaurant, id, false)).rejects.toThrow("iMenu Plus");
  expect(calls.some(({ sql }) => sql.includes("UPDATE public.whatsapp_bot_settings"))).toBe(false);
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

test("Marketing apply and undo preserve independent order notification settings", async () => {
  const { DEFAULT_AUTOMATIONS } = await import("@/lib/services/crmRules");
  current = { restaurant_id: restaurant, automations: { ...structuredClone(DEFAULT_AUTOMATIONS), order_notifications_enabled: true } };
  const originalImpl = c.query.getMockImplementation()!;
  c.query.mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes("UPDATE public.whatsapp_bot_settings")) {
      calls.push({ sql, params });
      const incoming = JSON.parse(params[2]);
      current.automations = sql.includes("||") ? { ...current.automations, ...incoming } : incoming;
      return { rows: [structuredClone(current)], rowCount: 1 };
    }
    return originalImpl(sql, params);
  });
  try {
    const settings = { ...structuredClone(DEFAULT_AUTOMATIONS), cart: { ...DEFAULT_AUTOMATIONS.cart, message: "Nova mensagem" } };
    const proposal = await propose(restaurant, id, id, { title: "Editar Marketing", reason: "Revisão", operations: [
      { entity: "whatsapp_bot_settings", kind: "update", id: restaurant, values: { automations: settings } },
    ] });
    action.operations = proposal.operations;
    action = await execute(restaurant, id, false);
    expect(current.automations.order_notifications_enabled).toBe(true);
    current.automations.order_notifications_enabled = false;
    await execute(restaurant, id, true);
    expect(current.automations.order_notifications_enabled).toBe(false);
    expect(current.automations.cart.message).toBe(DEFAULT_AUTOMATIONS.cart.message);
  } finally { c.query.mockImplementation(originalImpl); }
});

test("item display schedules apply and undo through the existing proposal", async () => {
  const schedule = [{ days: [5], start: "18:00", end: "01:00" }];
  current.availability_schedule = null;
  action.operations[0] = {
    ...action.operations[0],
    values: { availability_schedule: schedule },
    before: { availability_schedule: null },
  };
  const originalQuery = c.query.getMockImplementation()!;
  await c.query.withImplementation(async (sql, params = []) => {
    if (!sql.includes('SET "availability_schedule"=')) return originalQuery(sql, params);
    calls.push({ sql, params });
    current.availability_schedule = params[2] === null ? null : JSON.parse(params[2]);
    return { rows: [structuredClone(current)] };
  }, async () => {
    action = await execute(restaurant, id, false);
    expect(action.status).toBe("applied");
    expect(current.availability_schedule).toEqual(schedule);
    await expect(execute(restaurant, id, true)).resolves.toMatchObject({ status: "undone" });
    expect(current.availability_schedule).toBeNull();
  });
});

test("extra loyalty rewards must belong to the restaurant and their complements to the selected item", async () => {
  const primary = "33333333-3333-4333-8333-333333333333";
  const extra = "44444444-4444-4444-8444-444444444444";
  const complement = "55555555-5555-4555-8555-555555555555";
  const originalQuery = c.query.getMockImplementation()!;
  let extraOwned = false;
  let complementMatches = false;
  const draft = {
    title: "Recompensa de fidelidade",
    reason: "Incluir um item na recompensa",
    operations: [{
      entity: "loyalty_programs",
      kind: "update",
      id,
      values: { additional_rewards: [{ item_id: extra, subitem_ids: [complement] }] },
    }],
  };

  await c.query.withImplementation(async (sql, params = []) => {
    if (sql.includes("SELECT t.* FROM public.loyalty_programs")) {
      return { rows: [{ restaurant_id: restaurant, id, active: true, goal_count: 5, reward_item_id: primary }] };
    }
    if (sql.includes("SELECT t.* FROM public.items")) {
      return { rows: params[0] === restaurant && (params[1] === primary || (params[1] === extra && extraOwned))
        ? [{ id: params[1], restaurant_id: restaurant }] : [] };
    }
    if (sql.startsWith("SELECT s.id FROM public.subitems")) {
      expect(params).toEqual([extra, [complement]]);
      return { rows: complementMatches ? [{ id: complement }] : [] };
    }
    return originalQuery(sql, params);
  }, async () => {
    await expect(propose(restaurant, id, id, draft)).rejects.toThrow("referência não pertence");
    extraOwned = true;
    await expect(propose(restaurant, id, id, draft)).rejects.toThrow("complementos devem pertencer");
    complementMatches = true;
    await expect(propose(restaurant, id, id, draft)).resolves.toMatchObject({
      status: "pending",
      operations: [{ values: draft.operations[0].values }],
    });
  });
});

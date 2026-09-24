import { metrics, window28 } from "./data";
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import {
  fields,
  key,
  scope,
  validate,
  validateMerged,
  PARENTS,
  SINGLETONS,
  isUuid,
} from "./catalog";
import { LIMITS } from "./config";
import {
  SalesError,
  object,
  same,
  type Action,
  type Data,
  type Operation,
} from "./types";

function normalizeNumbers(entity: string, record: Data | null | undefined) {
  if (!record) return record;
  const normalized = { ...record };
  for (const [field, definition] of Object.entries(fields(entity))) {
    if (["numeric", "real", "integer", "smallint"].includes(definition.type) && typeof normalized[field] === "string") {
      normalized[field] = Number(normalized[field]);
    }
  }
  return normalized;
}

async function row(
  c: PoolClient,
  restaurant: string,
  entity: string,
  id: string,
) {
  if (!isUuid(id)) throw new SalesError("Identificador inválido.");
  return normalizeNumbers(entity, (
    await c.query(
      `SELECT t.* FROM public.${entity} t WHERE ${scope(entity)} AND t.${key(entity)}=$2 FOR UPDATE`,
      [restaurant, id],
    )
  ).rows[0]);
}
async function references(
  c: PoolClient,
  restaurant: string,
  entity: string,
  value: Data,
  planned: Operation[] = [],
) {
  const refs: [string, string][] = [];
  for (const [field, parent] of Object.entries(PARENTS[entity] || {}))
    if (value[field]) refs.push([parent, value[field]]);
  for (const id of value.pizza_settings?.category_ids || [])
    refs.push(["categories", id]);
  for (const p of value.automatic_promotions || [])
    for (const r of [...p.rules, ...p.benefits])
      if (r.item_id) refs.push(["items", r.item_id]);
  for (const id of value.reward_subitem_ids || []) refs.push(["subitems", id]);
  for (const [parent, id] of refs)
    if (
      !planned.some(
        (o) => o.kind === "create" && o.entity === parent && o.id === id,
      ) &&
      !(await row(c, restaurant, parent, id))
    )
      throw new SalesError("Uma referência não pertence ao restaurante.");
  if (entity === "loyalty_programs" && value.reward_subitem_ids?.length) {
    const ids = (
      await c.query(
        "SELECT s.id FROM public.subitems s JOIN public.item_subcategories g ON g.id=s.item_subcategory_id WHERE g.item_id=$1 AND s.id=ANY($2::uuid[])",
        [value.reward_item_id, value.reward_subitem_ids],
      )
    ).rows;
    if (ids.length !== value.reward_subitem_ids.length)
      throw new SalesError("Os complementos devem pertencer à recompensa.");
  }
}
async function deletable(c: PoolClient, entity: string, id: string) {
  // Never cascade into orders, history, balances, or unrelated records.
  const refs = await c.query(
    `SELECT ns.nspname AS schema, cl.relname AS table_name, a.attname AS column_name FROM pg_constraint k JOIN pg_class cl ON cl.oid=k.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1] WHERE k.contype='f' AND k.confrelid=$1::regclass`,
    [`public.${entity}`],
  );
  for (const r of refs.rows) {
    if (
      ![r.schema, r.table_name, r.column_name].every((x: string) =>
        /^[a-z_][a-z0-9_]*$/.test(x),
      )
    )
      throw new SalesError("Referência não suportada.");
    if (
      (
        await c.query(
          `SELECT 1 FROM "${r.schema}"."${r.table_name}" WHERE "${r.column_name}"=$1 LIMIT 1`,
          [id],
        )
      ).rowCount
    )
      throw new SalesError(
        "Este registro já está em uso. Proponha desativá-lo para preservar o histórico.",
      );
  }
  if (
    ["items", "categories", "subitems"].includes(entity) &&
    (
      await c.query(
        "SELECT 1 FROM public.restaurants WHERE automatic_promotions::text LIKE $1 OR pizza_settings::text LIKE $1 LIMIT 1",
        [`%${id}%`],
      )
    ).rowCount
  )
    throw new SalesError("O registro está em uso por uma configuração.");
}
const selectFields = (r: Data, names: string[]) =>
  Object.fromEntries(names.map((k) => [k, r[k] ?? null]));
const parameter = (e: string, k: string, v: any) =>
  fields(e)[k]?.type === "jsonb" ? JSON.stringify(v) : v;
async function write(c: PoolClient, restaurant: string, op: Operation) {
  if (op.kind === "delete") {
    await deletable(c, op.entity, op.id);
    await c.query(
      `DELETE FROM public.${op.entity} t WHERE ${scope(op.entity)} AND t.${key(op.entity)}=$2`,
      [restaurant, op.id],
    );
    return null;
  }
  if (op.kind === "update") {
    const entries = Object.entries(op.values);
    if (!entries.length) throw new SalesError("Alteração vazia.");
    return (
      await c.query(
        `UPDATE public.${op.entity} t SET ${entries.map(([k], i) => `"${k}"=$${i + 3}`).join(",")} WHERE ${scope(op.entity)} AND t.${key(op.entity)}=$2 RETURNING t.*`,
        [
          restaurant,
          op.id,
          ...entries.map(([k, v]) => parameter(op.entity, k, v)),
        ],
      )
    ).rows[0];
  }
  const values: Data = { ...op.values, [key(op.entity)]: op.id };
  if (!["item_subcategories", "subitems", "restaurants"].includes(op.entity))
    values.restaurant_id = restaurant;
  const entries = Object.entries(values);
  if (entries.some(([k]) => !/^[a-z_]+$/.test(k)))
    throw new SalesError("Campo inválido.");
  return (
    await c.query(
      `INSERT INTO public.${op.entity} (${entries.map(([k]) => `"${k}"`).join(",")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
      entries.map(([k, v]) => parameter(op.entity, k, v)),
    )
  ).rows[0];
}
export async function propose(
  restaurant: string,
  conversation: string,
  run: string,
  input: unknown,
): Promise<Action> {
  const draft = object(input);
  if (
    typeof draft.title !== "string" ||
    !draft.title.trim() ||
    draft.title.length > 180 ||
    typeof draft.reason !== "string" ||
    draft.reason.length > 3000 ||
    !Array.isArray(draft.operations) ||
    !draft.operations.length ||
    draft.operations.length > LIMITS.operations
  )
    throw new SalesError("Proposta inválida.");
  return withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      restaurant,
    ]);
    if (
      Number(
        (
          await c.query(
            "SELECT count(*) n FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND run_id=$2",
            [restaurant, run],
          )
        ).rows[0].n,
      ) >= LIMITS.actions
    )
      throw new SalesError("Revise as propostas antes de continuar.");
    const ops: Operation[] = [];
    for (const raw of draft.operations) {
      const d = object(raw),
        defs = fields(d.entity);
      if (!["create", "update", "delete"].includes(d.kind))
        throw new SalesError("Operação inválida.");
      if (
        (d.kind === "create" && d.entity === "restaurants") ||
        (d.kind === "delete" && SINGLETONS.includes(d.entity))
      )
        throw new SalesError("Use uma atualização nesta configuração.");
      const id =
        d.kind === "create"
          ? d.entity === "whatsapp_bot_settings"
            ? restaurant
            : randomUUID()
          : d.id;
      if (ops.some((o) => o.entity === d.entity && o.id === id))
        throw new SalesError("Agrupe alterações do mesmo registro.");
      const old =
        d.kind === "create" ? null : await row(c, restaurant, d.entity, id);
      if (d.kind !== "create" && !old)
        throw new SalesError("Registro não encontrado.", 404);
      const values =
        d.kind === "delete"
          ? {}
          : validate(d.entity, d.values, d.kind === "create");
      if (d.kind === "delete") await deletable(c, d.entity, id);
      else {
        validateMerged(d.entity, { ...old, ...values });
        await references(c, restaurant, d.entity, { ...old, ...values }, ops);
      }
      ops.push({
        entity: d.entity,
        kind: d.kind,
        id,
        values,
        before: old
          ? d.kind === "delete"
            ? old
            : selectFields(old, Object.keys(values))
          : null,
        label: String(
          old?.name || old?.code || values.name || values.code || d.entity,
        ).slice(0, 180),
      });
      void defs;
    }
    return (
      await c.query(
        "INSERT INTO public.ia_vendas_actions (restaurant_id,conversation_id,run_id,title,reason,operations) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *",
        [
          restaurant,
          conversation,
          run,
          draft.title,
          draft.reason,
          JSON.stringify(ops),
        ],
      )
    ).rows[0];
  });
}
export async function claim(restaurant: string, id: string) {
  return (
    await query<Action>(
      `UPDATE public.ia_vendas_actions SET status='applying',attempts=attempts+1,claimed_at=now(),error=null WHERE id=$1 AND restaurant_id=$2 AND attempts<2 AND (status IN ('pending','failed') OR (status='applying' AND claimed_at<now()-interval '6 minutes')) RETURNING *`,
      [id, restaurant],
    )
  ).rows[0];
}
export async function apply(restaurant: string, id: string): Promise<Action> {
  const claimed = await claim(restaurant, id);
  if (!claimed) {
    const old = (
      await query<Action>(
        "SELECT * FROM public.ia_vendas_actions WHERE id=$1 AND restaurant_id=$2",
        [id, restaurant],
      )
    ).rows[0];
    if (old?.status === "applied") return old;
    throw new SalesError(
      "Proposta indisponível, em aplicação ou sem novas tentativas.",
      409,
    );
  }
  try {
    return await execute(restaurant, id, false);
  } catch (e: any) {
    const completed = (
      await query<Action>(
        "SELECT * FROM public.ia_vendas_actions WHERE id=$1 AND restaurant_id=$2",
        [id, restaurant],
      )
    ).rows[0];
    if (completed?.status === "applied") return completed;
    await query(
      "UPDATE public.ia_vendas_actions SET status=$3,error=$4 WHERE id=$1 AND restaurant_id=$2 AND status='applying'",
      [
        id,
        restaurant,
        e instanceof SalesError && e.status === 409 ? "conflict" : "failed",
        e instanceof SalesError
          ? e.message
          : "Não foi possível aplicar. Tente novamente uma vez.",
      ],
    );
    // Persisted attempts cap includes manual retries and survives multiple API requests.
    if (["40001", "40P01", "55P03"].includes(e.code) && claimed.attempts < 2)
      return apply(restaurant, id);
    throw e;
  }
}
export async function execute(
  restaurant: string,
  id: string,
  undo: boolean,
): Promise<Action> {
  return withTransaction(async (c) => {
    await c.query("SET LOCAL statement_timeout='15s'");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      restaurant,
    ]);
    const action = (
      await c.query(
        "SELECT * FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND id=$2 FOR UPDATE",
        [restaurant, id],
      )
    ).rows[0] as Action;
    if (!action) throw new SalesError("Proposta não encontrada.", 404);
    if (action.status === (undo ? "undone" : "applied")) return action;
    if (
      action.status !== (undo ? "applied" : "applying") ||
      !action.operations.length
    )
      throw new SalesError("Estado da proposta inválido.", 409);
    const window = window28();
    const baseline = undo
      ? action.baseline
      : await metrics(restaurant, window.start, window.end, c);
    if (baseline) delete baseline.products;
    const operations = undo
      ? [...action.operations].reverse()
      : action.operations;
    for (const original of operations) {
      const current = await row(c, restaurant, original.entity, original.id),
        expected = undo ? original.after : original.before;
      const compared =
        current && expected
          ? selectFields(current, Object.keys(expected))
          : (current ?? null);
      if (!same(compared, expected))
        throw new SalesError(
          "O registro mudou desde a proposta. Peça uma proposta atualizada.",
          409,
        );
      const op: Operation = undo
        ? {
            ...original,
            kind:
              original.kind === "create"
                ? "delete"
                : original.kind === "delete"
                  ? "create"
                  : "update",
            values: original.before || {},
          }
        : original;
      if (op.kind !== "delete") {
        if (!(undo && op.kind === "create"))
          validate(op.entity, op.values, op.kind === "create");
        validateMerged(op.entity, { ...current, ...op.values });
        await references(c, restaurant, op.entity, {
          ...current,
          ...op.values,
        });
      }
      const updated = normalizeNumbers(op.entity, await write(c, restaurant, op));
      if (!undo)
        original.after = updated
          ? original.kind === "update"
            ? selectFields(updated, Object.keys(original.values))
            : updated
          : null;
    }
    if (
      Number(
        (
          await c.query(
            "SELECT count(*) n FROM public.upsell WHERE restaurant_id=$1",
            [restaurant],
          )
        ).rows[0].n,
      ) > 5
    )
      throw new SalesError("O carrinho permite até cinco upsells.");
    return (
      await c.query(
        `UPDATE public.ia_vendas_actions SET status=$3,operations=$4::jsonb,baseline=$5::jsonb,${undo ? "undone_at" : "applied_at"}=now() WHERE id=$1 AND restaurant_id=$2 RETURNING *`,
        [
          id,
          restaurant,
          undo ? "undone" : "applied",
          JSON.stringify(action.operations),
          JSON.stringify(baseline),
        ],
      )
    ).rows[0];
  });
}

import { query } from "@/lib/database/sql";
import { CUSTOMER_SEGMENTS, type CustomerSegment } from "./crmRules";

export const PURCHASE_SQL =
  "status NOT IN ('canceled','pending_online_payment')";
export type CustomerRow = {
  phone: string;
  name: string | null;
  address: Record<string, string> | null;
  marketing_consent: boolean;
  opted_out_at: string | null;
  order_count: number;
  spending_cents: number;
  average_ticket_cents: number;
  last_purchase: string | null;
  segment: CustomerSegment;
};
export async function listCustomers(
  restaurantId: string,
  search = "",
  segment = "",
  page = 1,
  orders = "",
  marketing = "",
  sort = "last:desc",
) {
  const sortColumns: Record<string, string> = {
    name: "name",
    segment: "CASE segment WHEN 'Destaque' THEN 1 WHEN 'Frequente' THEN 2 WHEN 'Novo' THEN 3 WHEN 'Em risco' THEN 4 WHEN 'Inativo' THEN 5 ELSE 6 END",
    orders: "order_count",
    spent: "spending_cents",
    ticket: "average_ticket_cents",
    last: "last_purchase",
  };
  const [field, direction] = sort.split(":");
  const sortColumn = sortColumns[field] || sortColumns.last;
  const sortDirection = direction === "asc" ? "ASC" : "DESC";
  const result = await query<CustomerRow & { total: string }>(
    `
        WITH metrics AS (
            SELECT public.crm_phone(customer_phone) phone, count(*)::int order_count,
              sum(total_cents)::bigint spending_cents, round(avg(total_cents))::int average_ticket_cents,
              max(created_at) last_purchase
            FROM orders WHERE restaurant_id=$1 AND ${PURCHASE_SQL} GROUP BY 1
        ), customers_with_metrics AS (
            SELECT c.*, coalesce(m.order_count,0) order_count, coalesce(m.spending_cents,0) spending_cents,
              coalesce(m.average_ticket_cents,0) average_ticket_cents, m.last_purchase,
              CASE WHEN m.last_purchase IS NULL OR m.last_purchase <= now()-interval '60 days' THEN 'Inativo'
                WHEN m.last_purchase <= now()-interval '30 days' THEN 'Em risco'
                WHEN m.order_count>=10 OR m.spending_cents>=100000 THEN 'Destaque'
                WHEN m.order_count>=3 THEN 'Frequente' ELSE 'Novo' END segment
            FROM customers c LEFT JOIN metrics m USING (phone) WHERE c.restaurant_id=$1
        ) SELECT *,count(*) OVER() total FROM customers_with_metrics
        WHERE ($2='' OR name ILIKE '%'||$2||'%' OR phone LIKE '%'||$2||'%')
          AND ($3='' OR segment=$3)
          AND ($4='' OR ($4='none' AND order_count=0)
            OR ($4='few' AND order_count BETWEEN 1 AND 2)
            OR ($4='regular' AND order_count BETWEEN 3 AND 9)
            OR ($4='tenPlus' AND order_count>=10))
          AND ($5='' OR ($5='consented' AND marketing_consent IS TRUE AND opted_out_at IS NULL)
            OR ($5='notConsented' AND (marketing_consent IS NOT TRUE OR opted_out_at IS NOT NULL)))
        ORDER BY ${sortColumn} ${sortDirection} NULLS LAST,phone LIMIT 25 OFFSET $6`,
    [
      restaurantId,
      search.slice(0, 100),
      CUSTOMER_SEGMENTS.includes(segment as CustomerSegment) ? segment : "",
      ["none", "few", "regular", "tenPlus"].includes(orders) ? orders : "",
      ["consented", "notConsented"].includes(marketing) ? marketing : "",
      (page - 1) * 25,
    ],
  );
  return {
    customers: result.rows.map(({ total, ...row }) => ({
      ...row,
      order_count: Number(row.order_count),
      spending_cents: Number(row.spending_cents),
    })),
    total: Number(result.rows[0]?.total || 0),
  };
}
export async function customerDetails(restaurantId: string, phone: string) {
  const [profile, orders, favorites] = await Promise.all([
    query(
      "SELECT phone,name,address,marketing_consent,opted_out_at FROM customers WHERE restaurant_id=$1 AND phone=$2",
      [restaurantId, phone],
    ),
    query(
      `SELECT id,display_id,status,total_cents,created_at FROM orders WHERE restaurant_id=$1 AND public.crm_phone(customer_phone)=$2 ORDER BY created_at DESC LIMIT 50`,
      [restaurantId, phone],
    ),
    query(
      `SELECT oi.item_id, max(oi.name) name,sum(oi.quantity)::int quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.restaurant_id=$1 AND public.crm_phone(o.customer_phone)=$2 AND o.${PURCHASE_SQL} GROUP BY oi.item_id ORDER BY quantity DESC LIMIT 5`,
      [restaurantId, phone],
    ),
  ]);
  return {
    customer: profile.rows[0] || null,
    orders: orders.rows,
    favorites: favorites.rows,
  };
}

import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { PoolClient } from "pg";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query, withTransaction } from "@/lib/database/sql";
import {
    authorizedXml, buildNote, cancelNote, consultNote, fiscalEnvironment, paymentCode, readCertificate, sendNote,
    type FiscalEnvironment, type Issuer, type Recipient, type Sale,
} from "./sefaz";

export const zipXml = promisify(gzip);
export const unzipXml = promisify(gunzip);
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NoteSummary = {
    order_id: string; status: string; access_key: string | null; number: number | null;
    series: number | null; protocol: string | null; issued_at: string; error: string | null;
};
type Job = NoteSummary & {
    restaurant_id: string; environment: FiscalEnvironment; signed_xml: Buffer | null;
    cancellation_xml: Buffer | null; qr_url: string | null; offline: boolean; sale: Sale | null;
    attempts: number; attempt_token: string;
};
export type IssuerRow = { data: Issuer; certificate: string | null; enabled: boolean; next_number: number; environment: FiscalEnvironment };
type OrderRow = {
    id: string; total_cents: number; delivery_cents: number; customer_name: string | null;
    status: string; is_delivery: string | null; payment_method: string | null; imported: boolean;
};

export class FiscalError extends Error {
    constructor(message: string, public status = 422) { super(message); }
}

export const spNow = () => new Date(Date.now() - 10_800_000).toISOString().slice(0, 19) + "-03:00";

export async function activeFiscalIssuer(restaurant: string, client?: PoolClient) {
    const environment = fiscalEnvironment();
    if (!environment) return null;

    const sql = `SELECT data FROM public.nfce_issuers
        WHERE restaurant_id=$1 AND environment=$2 AND enabled AND certificate IS NOT NULL`;
    const args = [restaurant, environment];
    const issuer = (client ? await client.query<{ data: Issuer }>(sql, args) : await query<{ data: Issuer }>(sql, args)).rows[0];
    if (!issuer || !await hasIMenuPlusAccess(restaurant, client)) return null;
    return { environment, data: issuer.data };
}

export async function hasFiscalDocumentInUse(client: PoolClient, order: string) {
    return Boolean((await client.query(`SELECT 1 FROM public.nfce_documents
        WHERE order_id=$1 AND environment=1 AND status IN ('pending','processing','contingency','authorized')
        AND (status<>'authorized' OR authorized_xml IS NOT NULL) LIMIT 1`, [order])).rowCount);
}

export async function hasPendingFiscalDocument(client: PoolClient, order: string) {
    return Boolean((await client.query(`SELECT 1 FROM public.nfce_documents
        WHERE order_id=$1 AND environment=1 AND status IN ('pending','processing','contingency') LIMIT 1`, [order])).rowCount);
}

export function needsFiscalNote(status: string, type: string | null) {
    return (type === "entrega" && ["delivering", "done"].includes(status))
        || (["balcao", "retirada"].includes(type ?? "") && status === "done");
}

export async function prepareOrderNote(client: PoolClient, restaurant: string, order: string, status: string, type: string | null) {
    if (!needsFiscalNote(status, type) || !await activeFiscalIssuer(restaurant, client)) return null;
    await enqueueOrderNote(client, restaurant, order, 1);
    return (await client.query<{ status: string; error: string | null; has_document: boolean }>(`
        SELECT status,error,CASE WHEN offline THEN signed_xml IS NOT NULL ELSE authorized_xml IS NOT NULL END AS has_document
        FROM public.nfce_documents WHERE restaurant_id=$1 AND order_id=$2 AND environment=1`, [restaurant, order])).rows[0]
        ?? { status: "pending", error: null, has_document: false };
}

export async function queueOrderNote(client: PoolClient, restaurant: string, order: string, status: string, type: string | null) {
    const env = fiscalEnvironment();
    const issue = needsFiscalNote(status, type);
    if (!env || !issue || !await hasIMenuPlusAccess(restaurant, client)) return false;
    return enqueueOrderNote(client, restaurant, order, env);
}

async function enqueueOrderNote(client: PoolClient, restaurant: string, order: string, env: FiscalEnvironment) {
    return (await client.query(`
        INSERT INTO public.nfce_documents (restaurant_id, order_id, environment)
        SELECT restaurant_id, $2, environment FROM public.nfce_issuers
        WHERE restaurant_id=$1 AND environment=$3 AND enabled AND certificate IS NOT NULL
        ON CONFLICT (restaurant_id, order_id, environment) DO NOTHING`, [restaurant, order, env])).rowCount === 1;
}

async function getSale(job: Job, issuer: Issuer): Promise<Sale> {
    const [orderResult, rows, details] = await Promise.all([
        query<OrderRow>(`
            SELECT id,total_cents,delivery_cents,customer_name,status,is_delivery,payment_method,
            EXISTS(SELECT 1 FROM public.delivery_imported_orders i WHERE i.order_id=o.id) AS imported
            FROM public.orders o WHERE id=$1 AND restaurant_id=$2`, [job.order_id, job.restaurant_id]),
        query<{ item_id: string; name: string; quantity: number; total_cents: number }>(`
            SELECT i.item_id,i.name,i.quantity,i.total_cents FROM public.order_items i
            JOIN public.orders o ON o.id=i.order_id WHERE o.id=$1 AND o.restaurant_id=$2 ORDER BY i.id`, [job.order_id, job.restaurant_id]),
        query<{ recipient: Recipient | null; payment_method: string | null }>(`
            SELECT recipient,payment_method FROM public.nfce_order_details WHERE restaurant_id=$1 AND order_id=$2`, [job.restaurant_id, job.order_id]),
    ]);
    const order = orderResult.rows[0];
    if (!order || order.imported || !["pending_physical_payment", "paid", "preparing", "delivering", "done"].includes(order.status)) throw new FiscalError("Pedido indisponível para emissão.");
    const payment = details.rows[0]?.payment_method ?? order.payment_method ?? "";
    if (!paymentCode(payment)) throw new FiscalError("Informe o meio de pagamento na seção fiscal do pedido.");
    const delivery = order.is_delivery === "entrega";
    const recipient = details.rows[0]?.recipient ?? undefined;
    if (delivery && !recipient) throw new FiscalError("Informe o CPF e o endereço fiscal do destinatário.");
    if (!rows.rows.length || rows.rows.some(row => !row.item_id || row.quantity <= 0 || row.total_cents < 0)) {
        throw new FiscalError("Revise os itens do pedido.");
    }
    return {
        items: rows.rows.map(row => ({
            uuid: row.item_id, name: row.name.trim().slice(0, 120), quantity: row.quantity,
            cents: row.total_cents, tax: issuer.itemTaxes?.[row.item_id] ?? issuer.defaultTax,
        })),
        issuedAt: spNow(), deliveryCents: Number(order.delivery_cents ?? 0), totalCents: Number(order.total_cents), payment, delivery, recipient,
    };
}

async function storePendingXml(job: Job, config: IssuerRow, sale: Sale, identity: ReturnType<typeof readCertificate>, offline: boolean) {
    return withTransaction(async client => {
        const seq = await client.query<{ number: number }>(`
            UPDATE public.nfce_issuers SET next_number=next_number+1
            WHERE restaurant_id=$1 AND environment=$2 AND next_number<=999999999
            RETURNING next_number-1 AS number`, [job.restaurant_id, job.environment]);
        const number = seq.rows[0]?.number;
        if (!number) throw new FiscalError("Numeração fiscal indisponível.");
        const built = buildNote(config.data, sale, identity, job.environment, number, offline);
        const updated = await client.query<Job>(`
            UPDATE public.nfce_documents SET access_key=$4, number=$5, series=$6, signed_xml=$7,
                sale=$8, qr_url=$9, offline=$10, issued_at=$11
            WHERE restaurant_id=$1 AND order_id=$2 AND attempt_token=$3 RETURNING *`,
        [job.restaurant_id, job.order_id, job.attempt_token, built.key, number, config.data.series, await zipXml(built.xml), JSON.stringify(sale), built.qr, offline, sale.issuedAt]);
        if (!updated.rows[0]) throw new Error("A emissão foi retomada por outro processo.");
        return updated.rows[0];
    });
}

async function finish(job: Job, status: string, error: string | null, protocol?: string, document?: Buffer) {
    await query(`
        UPDATE public.nfce_documents SET status=$4, error=$5, protocol=COALESCE($6,protocol),
            authorized_xml=COALESCE($7,authorized_xml), attempt_token=NULL,
            retry_at=now() + LEAST(attempts, 12) * interval '30 seconds'
        WHERE restaurant_id=$1 AND order_id=$2 AND attempt_token=$3`,
    [job.restaurant_id, job.order_id, job.attempt_token, status, error, protocol ?? null, document ?? null]);
}

export async function processNote(orderId?: string) {
    const env = fiscalEnvironment();
    if (!env) return false;
    const claim = await query<Job>(`
        WITH next AS (SELECT restaurant_id,order_id,environment FROM public.nfce_documents
            WHERE environment=$1 AND ($2::uuid IS NULL OR order_id=$2)
              AND status IN ('pending','processing','contingency') AND retry_at<=now()
            ORDER BY retry_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        UPDATE public.nfce_documents d SET status='processing', attempts=d.attempts+1,
            retry_at=now()+interval '90 seconds', attempt_token=gen_random_uuid()
        FROM next n WHERE d.restaurant_id=n.restaurant_id AND d.order_id=n.order_id AND d.environment=n.environment RETURNING d.*`,
    [env, orderId ?? null]);
    let job = claim.rows[0];
    if (!job) return false;
    try {
        const config = (await query<IssuerRow>(`
            SELECT * FROM public.nfce_issuers WHERE restaurant_id=$1 AND environment=$2`, [job.restaurant_id, env])).rows[0];
        if (!config?.certificate) throw new FiscalError("Envie um certificado A1 válido.");
        if (!job.signed_xml && (!config.enabled || !await hasIMenuPlusAccess(job.restaurant_id))) throw new FiscalError("Emissão automática desativada.");
        const identity = readCertificate(job.restaurant_id, config.certificate);
        let result: Awaited<ReturnType<typeof sendNote>> | undefined;
        if (job.signed_xml && job.access_key) {
            result = await consultNote(env, identity, job.access_key);
            if (["108", "109", "656"].includes(result.code)) {
                await finish(job, job.offline ? "contingency" : "pending", result.message);
                return true;
            }
            if (!["100", "150", "217"].includes(result.code)) {
                await finish(job, "rejected", result.message || "Consulte a situação no portal da SEFAZ.");
                return true;
            }
        } else {
            const sale = job.sale ?? await getSale(job, config.data);
            job = await storePendingXml(job, config, sale, identity, false);
        }
        const xml = (await unzipXml(job.signed_xml!)).toString();
        if (!result || result.code === "217") result = await sendNote(env, identity, job.number!, xml);
        if (["108", "109"].includes(result.code) && !job.offline && job.sale) {
            job = await storePendingXml(job, config, { ...job.sale, issuedAt: spNow() }, identity, true);
            await finish(job, "contingency", result.message);
            return true;
        }
        if (["204", "539"].includes(result.code)) result = await consultNote(env, identity, job.access_key!);
        if (["100", "150"].includes(result.code) && result.key === job.access_key && result.protocol && result.number) {
            await finish(job, "authorized", null, result.number, await zipXml(authorizedXml(xml, result.protocol)));
        } else if (["105", "108", "109", "217", "656"].includes(result.code)) {
            await finish(job, job.offline ? "contingency" : "pending", result.message);
        } else {
            await finish(job, "rejected", result.message || "A SEFAZ não autorizou a nota.");
        }
    } catch (error) {
        await finish(job, error instanceof FiscalError ? "rejected" : job.offline ? "contingency" : "pending",
            error instanceof FiscalError ? error.message : "Falha na comunicação ou no certificado. Tentativa programada.");
    }
    return true;
}

export async function archiveSnapshot(restaurant: string, env: FiscalEnvironment, client?: PoolClient): Promise<string | null> {
    const sql = `SELECT md5(string_agg(access_key || COALESCE(md5(cancellation_xml), ''), ',' ORDER BY access_key)) AS snapshot
        FROM public.nfce_documents WHERE restaurant_id=$1 AND environment=$2 AND authorized_xml IS NOT NULL`;
    const values = [restaurant, env];
    const { rows } = client ? await client.query<{ snapshot: string | null }>(sql, values)
        : await query<{ snapshot: string | null }>(sql, values);
    return rows[0]?.snapshot ?? null;
}

export async function cancelIssued(restaurant: string, order: string, reason: string) {
    const env = fiscalEnvironment();
    const rows = await query<Job & { data: Issuer; certificate: string; sale_status: string }>(`
        SELECT d.*, i.data, i.certificate, o.status::text AS sale_status FROM public.nfce_documents d
        JOIN public.nfce_issuers i USING (restaurant_id,environment)
        JOIN public.orders o ON o.id=d.order_id AND o.restaurant_id=d.restaurant_id
        WHERE d.restaurant_id=$1 AND d.order_id=$2 AND d.environment=$3`, [restaurant, order, env]);
    const doc = rows.rows[0];
    if (doc?.status === "canceled") return;
    if (!env || !doc || doc.status !== "authorized" || !doc.protocol || !doc.access_key || doc.sale_status !== "canceled"
        || new Date(doc.issued_at).valueOf() + 30 * 60_000 < Date.now()) {
        throw new FiscalError("Confira se o pedido foi cancelado sem saída da mercadoria e se a nota está no prazo para cancelamento.");
    }
    const response = await cancelNote(env, readCertificate(restaurant, doc.certificate), doc.data, doc.access_key, doc.protocol, spNow(), reason);
    if (response.key !== doc.access_key || !["135", "155"].includes(response.code)) throw new FiscalError(response.message || "A SEFAZ não confirmou o cancelamento.");
    await query(`
        UPDATE public.nfce_documents SET status='canceled',cancellation_xml=$4
        WHERE restaurant_id=$1 AND order_id=$2 AND environment=$3 AND status='authorized'`,
    [restaurant, order, env, await zipXml(response.xml)]);
}

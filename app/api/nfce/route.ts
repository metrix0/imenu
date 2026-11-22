import { createHmac } from "node:crypto";
import { after, NextResponse } from "next/server";
import { Zip, ZipDeflate } from "fflate/browser";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";
import { certificateIdentity, fiscalEnvironment, paymentCode, sealCertificate, type FiscalAddress, type FiscalTax, type Issuer } from "@/lib/nfce/sefaz";
import { archiveSnapshot, cancelIssued, FiscalError, processNote, unzipXml, uuid, type NoteSummary } from "@/lib/nfce/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fields = "order_id,status,access_key,number,series,protocol,issued_at,error";
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, limit) : "";
const digits = (value: unknown) => typeof value === "string" ? value.replace(/\D/g, "") : "";

function boundedDate(input: string | null) {
    if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new FiscalError("Informe um período válido.");
    const date = new Date(input + "T00:00:00-03:00");
    if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== input) throw new FiscalError("Informe um período válido.");
    return date;
}

function file(data: Uint8Array, name: string, contentType: string) {
    return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Type": contentType, "Content-Disposition": `attachment; filename="${name}"` } });
}

async function owner(request: Request) {
    const params = new URL(request.url).searchParams;
    const restaurant = params.get("restaurantId") ?? "";
    if (!uuid.test(restaurant)) throw new FiscalError("Restaurante inválido.", 400);
    await requireRestaurantOwner(request, restaurant);
    return { params, restaurant, plus: await hasIMenuPlusAccess(restaurant), env: fiscalEnvironment() };
}

function exportReceipt(restaurant: string, snapshot: string) {
    return createHmac("sha256", Buffer.from(process.env.NFCE_KEY!, "hex"))
        .update(`nfce-archive:${restaurant}:${snapshot}`).digest("hex");
}

function failure(error: unknown) {
    if (error instanceof FiscalError || error instanceof RestaurantOwnerAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    console.error("[NFCE] Falha no processamento:", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({ error: "Não foi possível concluir a operação fiscal." }, { status: 500, headers });
}

export async function GET(request: Request) {
    try {
        if (!fiscalEnvironment()) return NextResponse.json({ available: false, notes: [], issuer: null }, { headers });
        const { params, restaurant, plus, env } = await owner(request);
        const action = params.get("action") ?? "list";
        if (!env) return NextResponse.json({ available: false, plus, notes: [], issuer: null }, { headers });
        if (action === "settings") {
            if (!plus) throw new FiscalError("Disponível com iMenu Plus.", 403);
            const [issuer, items] = await Promise.all([
                query(`SELECT data,enabled,certificate IS NOT NULL AS has_certificate,next_number
                    FROM public.nfce_issuers WHERE restaurant_id=$1 AND environment=$2`, [restaurant, env]),
                query<{ id: string; name: string }>("SELECT id,name FROM public.items WHERE restaurant_id=$1 ORDER BY name,id", [restaurant]),
            ]);
            return NextResponse.json({ available: true, plus, environment: env, issuer: issuer.rows[0] ?? null, items: items.rows }, { headers });
        }
        if (action === "zip") {
            const everything = params.get("all") === "1" && !plus;
            const start = everything ? null : boundedDate(params.get("start"));
            const end = everything ? null : boundedDate(params.get("end"));
            if (start && end && start > end) throw new FiscalError("Selecione um período válido.");
            end?.setUTCDate(end.getUTCDate() + 1);
            const snapshot = everything ? await archiveSnapshot(restaurant, env) : null;
            type ArchiveRow = { access_key: string; issued_at: string; authorized_xml: Buffer; cancellation_xml: Buffer | null };
            const load = async (last?: ArchiveRow) => (await query<ArchiveRow>(`
                SELECT access_key,issued_at::text,authorized_xml,cancellation_xml FROM public.nfce_documents
                WHERE restaurant_id=$1 AND environment=$2 AND ($3::timestamptz IS NULL OR issued_at >= $3)
                  AND ($4::timestamptz IS NULL OR issued_at < $4) AND authorized_xml IS NOT NULL AND ($5::timestamptz IS NULL OR (issued_at,access_key)>($5,$6))
                ORDER BY public.nfce_documents.issued_at,access_key LIMIT 80`, [restaurant, env, start, end, last?.issued_at ?? null, last?.access_key ?? null])).rows;
            let batch = await load();
            if (!batch.length) throw new FiscalError("Nenhuma nota autorizada neste período.", 404);
            let last: ArchiveRow | undefined;
            let index = 0;
            let abandoned = false;
            const zip = new Zip();
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    zip.ondata = (error, chunk, final) => {
                        if (abandoned) return;
                        if (error) { abandoned = true; controller.error(error); }
                        else {
                            controller.enqueue(new Uint8Array(chunk));
                            if (final) controller.close();
                        }
                    };
                },
                async pull(controller) {
                    try {
                        if (index >= batch.length) { batch = await load(last); index = 0; }
                        const doc = batch[index++];
                        if (!doc) { zip.end(); return; }
                        last = doc;
                        const add = async (name: string, data: Buffer) => {
                            const xml = await unzipXml(data);
                            if (abandoned) return;
                            const entry = new ZipDeflate(name, { level: 3 });
                            zip.add(entry);
                            entry.push(xml, true);
                        };
                        await add(`${doc.access_key}-procNFe.xml`, doc.authorized_xml);
                        if (doc.cancellation_xml) await add(`${doc.access_key}-cancelamento.xml`, doc.cancellation_xml);
                    } catch (error) {
                        if (!abandoned) { abandoned = true; zip.terminate(); controller.error(error); }
                    }
                },
                cancel() { abandoned = true; zip.terminate(); },
            });
            const name = everything ? "nfce-arquivo-completo.zip" : `nfce-${params.get("start")}-${params.get("end")}.zip`;
            const archiveHeaders = new Headers({ ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` });
            if (snapshot) archiveHeaders.set("X-Nfce-Archive-Receipt", exportReceipt(restaurant, snapshot));
            return new Response(stream, { headers: archiveHeaders });
        }
        if (action === "xml" || action === "pdf") {
            const order = params.get("order") ?? "";
            if (!uuid.test(order)) throw new FiscalError("Pedido inválido.");
            const doc = (await query<{ access_key: string; authorized_xml: Buffer | null; signed_xml: Buffer; status: string; offline: boolean }>(`
                SELECT access_key,authorized_xml,signed_xml,status,offline FROM public.nfce_documents
                WHERE restaurant_id=$1 AND order_id=$2 AND environment=$3`, [restaurant, order, env])).rows[0];
            if (!doc?.access_key || (!doc.authorized_xml && !(action === "pdf" && doc.offline && doc.status === "contingency"))) {
                throw new FiscalError("Documento ainda não disponível.", 404);
            }
            const xml = await unzipXml(doc.authorized_xml ?? doc.signed_xml);
            if (action === "xml") return file(xml, `${doc.access_key}.xml`, "application/xml");
            const { danfePdf } = await import("@/lib/nfce/danfe");
            return file(danfePdf(xml.toString()), `danfe-${doc.access_key}.pdf`, "application/pdf");
        }
        const orderIds = (params.get("orders") ?? "").split(",").filter(Boolean);
        if (orderIds.length > 100 || orderIds.some(id => !uuid.test(id))) throw new FiscalError("Pedidos inválidos.");
        const [notes, hasArchive, activeIssuer] = await Promise.all([
            plus && orderIds.length ? query<NoteSummary>(`
                SELECT ${fields} FROM public.nfce_documents WHERE restaurant_id=$1 AND environment=$2 AND order_id=ANY($3::uuid[])
                  AND (authorized_xml IS NOT NULL OR status NOT IN ('authorized','canceled'))`,
            [restaurant, env, orderIds]) : Promise.resolve({ rows: [] }),
            query("SELECT 1 FROM public.nfce_documents WHERE restaurant_id=$1 AND environment=$2 AND authorized_xml IS NOT NULL LIMIT 1", [restaurant, env]),
            plus ? query("SELECT 1 FROM public.nfce_issuers WHERE restaurant_id=$1 AND environment=$2 AND enabled LIMIT 1", [restaurant, env]) : Promise.resolve({ rowCount: 0 }),
        ]);
        return NextResponse.json({ available: true, plus, archive: Boolean(hasArchive.rowCount), configured: Boolean(activeIssuer.rowCount), notes: notes.rows }, { headers });
    } catch (error) { return failure(error); }
}

function address(value: Record<string, unknown>, requireCep = true): FiscalAddress {
    const result = {
        street: text(value.street, 60), number: text(value.number, 60), district: text(value.district, 60),
        cityCode: digits(value.cityCode), city: text(value.city, 60), cep: digits(value.cep),
    };
    if (!result.street || !result.number || !result.district || !result.city || !/^35\d{5}$/.test(result.cityCode) || ((requireCep || result.cep) && !/^\d{8}$/.test(result.cep))) {
        throw new FiscalError("Revise o endereço em São Paulo e o código IBGE do município.");
    }
    return result;
}

function tax(value: Record<string, unknown>): FiscalTax {
    const result = { ncm: digits(value?.ncm), cfop: digits(value?.cfop), csosn: digits(value?.csosn), origin: digits(value?.origin), cest: digits(value?.cest) };
    if (!/^\d{8}$/.test(result.ncm) || !/^5\d{3}$/.test(result.cfop) || !["102", "103", "300", "400"].includes(result.csosn)
        || !/^[0-8]$/.test(result.origin) || (result.cest && !/^\d{7}$/.test(result.cest))) throw new FiscalError("Revise NCM, CFOP, CSOSN, origem e CEST.");
    return result;
}

export async function POST(request: Request) {
    try {
        const { params, restaurant, plus, env } = await owner(request);
        const action = params.get("action");
        if (env && action === "archive-received" && !plus) {
            const body = await request.json();
            await withTransaction(async client => {
                await client.query("SELECT restaurant_id FROM public.nfce_issuers WHERE restaurant_id=$1 AND environment=$2 FOR UPDATE", [restaurant, env]);
                if (await hasIMenuPlusAccess(restaurant, client)) throw new FiscalError("A assinatura está ativa.", 409);
                const snapshot = await archiveSnapshot(restaurant, env, client);
                if (!snapshot || body.confirmed !== true || body.receipt !== exportReceipt(restaurant, snapshot)) {
                    throw new FiscalError("Baixe o arquivo completo e confirme novamente.", 409);
                }
                const busy = await client.query(`SELECT 1 FROM public.nfce_documents
                    WHERE restaurant_id=$1 AND environment=$2 AND status IN ('processing','contingency','pending') LIMIT 1`, [restaurant, env]);
                if (busy.rowCount) throw new FiscalError("Ainda há notas em processamento.", 409);
                await client.query(`UPDATE public.nfce_documents SET authorized_xml=NULL,cancellation_xml=NULL,
                    signed_xml=NULL,sale=NULL,qr_url=NULL,access_key=NULL,protocol=NULL,error=NULL
                    WHERE restaurant_id=$1 AND environment=$2`, [restaurant, env]);
                await client.query("DELETE FROM public.nfce_order_details WHERE restaurant_id=$1", [restaurant]);
                await client.query("UPDATE public.nfce_issuers SET certificate=NULL,enabled=false WHERE restaurant_id=$1 AND environment=$2", [restaurant, env]);
            });
            return NextResponse.json({ ok: true }, { headers });
        }
        if (!env || !plus) throw new FiscalError("Emissão de notas fiscais indisponível.", 403);
        if (action === "settings") {
            const form = await request.formData();
            const raw = JSON.parse(String(form.get("settings") ?? "{}"));
            const overrides = Object.entries(raw.itemTaxes ?? {});
            if (overrides.length > 1000 || overrides.some(([key]) => !uuid.test(key))) throw new FiscalError("Configuração de itens inválida.");
            const config: Issuer = { ...address(raw), cnpj: digits(raw.cnpj), ie: digits(raw.ie), name: text(raw.name, 60),
                series: Number(raw.series), defaultTax: tax(raw.defaultTax),
                itemTaxes: Object.fromEntries(overrides.map(([key, value]) => [key, tax(value as Record<string, unknown>)])) };
            const next = Number(raw.nextNumber);
            if (!/^\d{14}$/.test(config.cnpj) || !/^\d{12}$/.test(config.ie) || config.name.length < 2
                || !Number.isInteger(config.series) || config.series < 0 || config.series > 889
                || !Number.isInteger(next) || next < 1 || next > 999999999) throw new FiscalError("Revise os dados do emitente.");
            const pfx = form.get("certificate");
            let encrypted: string | null = null;
            if (pfx instanceof File && pfx.size) {
                if (pfx.size > 131072) throw new FiscalError("Certificado muito grande.");
                const password = String(form.get("password") ?? "");
                const bytes = Buffer.from(await pfx.arrayBuffer());
                try { certificateIdentity(bytes, password); } catch { throw new FiscalError("Certificado A1, validade ou senha inválidos."); }
                encrypted = sealCertificate(restaurant, bytes, password);
            }
            const saved = await query(`
                INSERT INTO public.nfce_issuers (restaurant_id,environment,data,certificate,next_number,enabled)
                VALUES ($1,$2,$3,$4,$5,($6::boolean AND $4::text IS NOT NULL))
                ON CONFLICT (restaurant_id,environment) DO UPDATE SET data=excluded.data,
                    certificate=COALESCE(excluded.certificate,nfce_issuers.certificate),
                    next_number=GREATEST(excluded.next_number,nfce_issuers.next_number),
                    enabled=$6 AND COALESCE(excluded.certificate,nfce_issuers.certificate) IS NOT NULL
                WHERE (nfce_issuers.data->>'cnpj'=excluded.data->>'cnpj' AND nfce_issuers.data->>'series'=excluded.data->>'series')
                    OR NOT EXISTS (SELECT 1 FROM public.nfce_documents d WHERE d.restaurant_id=$1 AND d.environment=$2 AND d.access_key IS NOT NULL)
                RETURNING enabled,certificate IS NOT NULL AS has_certificate,next_number`,
            [restaurant, env, JSON.stringify(config), encrypted, next, raw.enabled === true]);
            if (!saved.rowCount) throw new FiscalError("CNPJ e série já estão vinculados a notas deste restaurante.");
            return NextResponse.json({ ...saved.rows[0], ok: true }, { headers });
        }
        const raw = await request.json();
        const order = text(raw.order, 36);
        if (!uuid.test(order)) throw new FiscalError("Pedido inválido.");
        if (params.get("action") === "cancel") {
            const reason = text(raw.reason, 255);
            if (reason.length < 15 || raw.noDispatch !== true) throw new FiscalError("Confirme que a mercadoria não saiu e informe a justificativa.");
            await cancelIssued(restaurant, order, reason);
            return NextResponse.json({ ok: true }, { headers });
        }
        const requestedPayment = text(raw.payment, 32);
        if (requestedPayment && !paymentCode(requestedPayment)) throw new FiscalError("Meio de pagamento inválido.");
        const saved = await query(`
            WITH wanted AS (
                SELECT o.id,o.restaurant_id FROM public.orders o
                JOIN public.nfce_issuers i ON i.restaurant_id=o.restaurant_id AND i.environment=$3 AND i.enabled
                WHERE o.id=$2 AND o.restaurant_id=$1 AND o.status IN ('preparing','delivering','done')
                    AND o.total_cents < 1000000
                    AND NOT EXISTS (SELECT 1 FROM public.delivery_imported_orders a WHERE a.order_id=o.id)
                    AND NOT EXISTS (SELECT 1 FROM public.nfce_documents d WHERE d.restaurant_id=$1 AND d.order_id=$2 AND d.environment=$3
                        AND (d.access_key IS NOT NULL OR d.status='processing'))
            ), details AS (
                INSERT INTO public.nfce_order_details (restaurant_id,order_id,payment_method)
                SELECT restaurant_id,id,$4 FROM wanted
                ON CONFLICT (restaurant_id,order_id) DO UPDATE SET payment_method=COALESCE(excluded.payment_method,nfce_order_details.payment_method)
                RETURNING restaurant_id,order_id
            )
            INSERT INTO public.nfce_documents (restaurant_id,order_id,environment)
                SELECT restaurant_id,order_id,$3 FROM details
            ON CONFLICT (restaurant_id,order_id,environment) DO UPDATE SET status='pending',error=NULL,retry_at=now()
                WHERE nfce_documents.access_key IS NULL AND nfce_documents.status='rejected' RETURNING order_id`,
        [restaurant, order, env, requestedPayment || null]);
        if (!saved.rowCount) throw new FiscalError("Emissão pendente, emitida ou indisponível para este pedido.", 409);
        after(() => processNote(order).then(() => undefined));
        return NextResponse.json({ ok: true }, { headers });
    } catch (error) { return failure(error); }
}

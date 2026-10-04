import { randomUUID } from "crypto";
import { analysisPreview } from "@/lib/ia-vendas/paywall";
import { aiAccess, requireIaPlus, IaPlusRequired } from "@/lib/ia-vendas/access";
import { analysisConversation } from "@/lib/ia-vendas/analysis";
import { runChat } from "@/lib/ia-vendas/chat";
import { query, withTransaction } from "@/lib/database/sql";
import { authorize, failure } from "@/lib/ia-vendas/http";
import { SalesError, type Action } from "@/lib/ia-vendas/types";
import { isUuid } from "@/lib/ia-vendas/catalog";
import { signedAttachment } from "@/lib/ia-vendas/files";
import { apply, execute } from "@/lib/ia-vendas/actions";
import { applyImages, publishImage } from "@/lib/ia-vendas/images";
import { imageUrl } from "@/lib/ia-vendas/data";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      restaurant = await authorize(
        request,
        url.searchParams.get("restaurant_id"),
      );
    await query(
      "INSERT INTO public.ia_vendas_conversations (restaurant_id,kind,title) VALUES ($1,'analysis','Análise') ON CONFLICT(restaurant_id) WHERE kind='analysis' DO NOTHING",
      [restaurant],
    );
    const conversations = (
      await query(
        "SELECT id,kind,title,updated_at FROM public.ia_vendas_conversations WHERE restaurant_id=$1 AND NOT archived ORDER BY (kind='analysis') DESC,updated_at DESC LIMIT 100",
        [restaurant],
      )
    ).rows;
    const id = url.searchParams.get("conversation_id") || conversations[0].id;
    if (!isUuid(id) || !conversations.some((c) => c.id === id))
      throw new SalesError("Conversa não encontrada.", 404);
    const analysisConversation =
      conversations.find((c) => c.id === id)?.kind === "analysis";
    const before = url.searchParams.get("before");
    if (before && !Number.isFinite(Date.parse(before)))
      throw new SalesError("Cursor inválido.");
    const [messages, actions, memory, running, refs, analyses] =
      await Promise.all([
        query(
          analysisConversation
            ? "SELECT m.*, (SELECT r.result->>'report_id' FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND (r.result->>'message_id'=m.id::text OR r.result->>'user_message_id'=m.id::text) LIMIT 1) report_id, (SELECT r.result->>'opportunity_id' FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND (r.result->>'message_id'=m.id::text OR r.result->>'user_message_id'=m.id::text) LIMIT 1) opportunity_id FROM public.ia_vendas_messages m WHERE restaurant_id=$1 AND conversation_id=$2 AND ($3::timestamptz IS NULL OR created_at<$3) AND ($4::boolean=false OR NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.kind='analysis' AND (r.result->>'message_id'=m.id::text OR r.result->>'user_message_id'=m.id::text))) ORDER BY created_at DESC LIMIT 51"
            : "SELECT * FROM public.ia_vendas_messages WHERE restaurant_id=$1 AND conversation_id=$2 AND ($3::timestamptz IS NULL OR created_at<$3) ORDER BY created_at DESC LIMIT 51",
          analysisConversation
            ? [restaurant, id, before, true]
            : [restaurant, id, before],
        ),
        query<Action>(
          `SELECT * FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND conversation_id=$2 AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.kind='analysis' AND (r.status<>'completed' OR r.result->'report'->>'status' IS DISTINCT FROM 'complete')) ORDER BY created_at DESC ${analysisConversation ? "" : "LIMIT 300"}`,
          [restaurant, id],
        ),
        query(
          "SELECT instructions FROM public.ia_vendas_memory WHERE restaurant_id=$1",
          [restaurant],
        ),
        query(
          "SELECT id,conversation_id,created_at,kind,result->'batch'->>'mode' mode FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND status='running' AND (created_at>now()-interval '6 minutes' OR result->'batch'->>'mode'='batch') ORDER BY (kind='chat') DESC,created_at DESC",
          [restaurant],
        ),
        query(
          "SELECT id,name FROM public.items WHERE restaurant_id=$1 UNION ALL SELECT id,name FROM public.categories WHERE restaurant_id=$1 UNION ALL SELECT g.id,g.name FROM public.item_subcategories g JOIN public.items i ON i.id=g.item_id WHERE i.restaurant_id=$1 UNION ALL SELECT s.id,s.name FROM public.subitems s JOIN public.item_subcategories g ON g.id=s.item_subcategory_id JOIN public.items i ON i.id=g.item_id WHERE i.restaurant_id=$1 UNION ALL SELECT u.id,i.name FROM public.upsell u JOIN public.items i ON i.id=u.item_id WHERE u.restaurant_id=$1 UNION ALL SELECT p.id,i.name FROM public.promotions p JOIN public.items i ON i.id=p.item_id WHERE p.restaurant_id=$1",
          [restaurant],
        ),
        analysisConversation
          ? query(
              "SELECT id,status,(result-'batch')||CASE WHEN result->'batch'->>'mode'='batch' THEN jsonb_build_object('batch',jsonb_build_object('mode','batch','status',result->'batch'->>'status','round',result->'batch'->'round')) ELSE '{}'::jsonb END result,created_at,finished_at FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND conversation_id=$2 AND kind='analysis' AND status='completed' AND result->>'detached_at' IS NULL AND result->'report'->>'status'='complete' ORDER BY created_at DESC",
              [restaurant, id],
            )
          : Promise.resolve({ rows: [] }),
      ]);
    const hydrated = await Promise.all(
      messages.rows
        .slice(0, 50)
        .reverse()
        .map(async (m) => ({
          ...m,
          attachments: await Promise.all(
            m.attachment_ids.map((a: string) =>
              signedAttachment(restaurant, a),
            ),
          ),
          cards: m.cards.map((c: any) =>
            c.type === "item" ? { ...c, image_url: imageUrl(c.image_path) } : c,
          ),
        })),
    );
    const hydratedActions = await Promise.all(
      actions.rows.map(async (a) => ({
        ...a,
        image: a.image
          ? {
              ...a.image,
              after: (await signedAttachment(restaurant, a.image.attachment_id))
                .url,
            }
          : undefined,
      })),
    );
    const access = await aiAccess(restaurant);
    const visibleAnalyses = access.plus ? analyses.rows : analyses.rows.map(analysisPreview);
    const visibleIds = new Set(visibleAnalyses.flatMap(a => [...(a.result?.report?.opportunities || []), ...(a.result?.report?.review_items || [])].flatMap(o => o.action_ids || [])));
    return Response.json(
      {
        access,
        restaurant_id: restaurant,
        conversation_id: id,
        conversations,
        messages: analysisConversation && !access.plus ? [] : hydrated,
        analyses: analysisConversation ? visibleAnalyses : [],
        actions: analysisConversation && !access.plus ? hydratedActions.filter(a => visibleIds.has(a.id)) : hydratedActions,
        instructions: memory.rows[0]?.instructions || "",
        analysis_available_at: null,
        running: running.rows[0] || null,
        has_more: messages.rows.length > 50,
        references: Object.fromEntries(refs.rows.map((r) => [r.id, r.name])),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json(),
      restaurant = await authorize(request, body.restaurant_id);
    if (body.command === "start_analysis") {
      await requireIaPlus(restaurant);
      const existing = (
        await query(
          "SELECT id FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND status='completed' AND result->>'detached_at' IS NULL AND result->'report'->>'status'='complete' ORDER BY created_at DESC LIMIT 1",
          [restaurant],
        )
      ).rows[0];
      if (existing)
        return Response.json({ status: "completed", run_id: existing.id });

      const running = (
        await query(
          "SELECT id FROM public.ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND status='running' ORDER BY created_at DESC LIMIT 1",
          [restaurant],
        )
      ).rows[0];
      if (running)
        return Response.json({ status: "running", run_id: running.id });

      const conversation = await analysisConversation(restaurant);
      const run = randomUUID();
      let analysisError: string | undefined;
      let duplicateStatus: string | undefined;
      await runChat({
        restaurant,
        conversation,
        run,
        text: "Analise meu restaurante e priorize as melhorias com maior impacto.",
        attachments: [],
        deep: true,
        immediate: true,
        send: (event, data) => {
          if (event === "error") analysisError = data.message;
          if (data.duplicate) duplicateStatus = data.status;
        },
      });
      if (analysisError) throw new SalesError(analysisError, 500);
      return Response.json({
        status: duplicateStatus || "completed",
        run_id: run,
        conversation_id: conversation,
      });
    }
    if (body.command === "create_conversation") {
      const row = (
        await query(
          "INSERT INTO public.ia_vendas_conversations (restaurant_id) VALUES ($1) RETURNING id",
          [restaurant],
        )
      ).rows[0];
      return Response.json(row);
    }
    if (
      ["rename_conversation", "archive_conversation"].includes(body.command)
    ) {
      if (!isUuid(body.conversation_id))
        throw new SalesError("Conversa inválida.");
      if (
        body.command === "rename_conversation" &&
        (typeof body.title !== "string" ||
          !body.title.trim() ||
          body.title.length > 80)
      )
        throw new SalesError("Use um título de até 80 caracteres.");
      const r = await query(
        `UPDATE public.ia_vendas_conversations SET ${body.command === "rename_conversation" ? "title=$3" : "archived=true"},updated_at=now() WHERE restaurant_id=$1 AND id=$2 AND kind='chat'`,
        body.command === "rename_conversation"
          ? [restaurant, body.conversation_id, body.title.trim()]
          : [restaurant, body.conversation_id],
      );
      if (!r.rowCount) throw new SalesError("A conversa Análise é fixa.", 409);
      return Response.json({ ok: true });
    }
    if (body.command === "save_instructions") {
      if (
        typeof body.instructions !== "string" ||
        body.instructions.length > 12000
      )
        throw new SalesError("Use até 12.000 caracteres.");
      await query(
        "INSERT INTO public.ia_vendas_memory (restaurant_id,instructions) VALUES ($1,$2) ON CONFLICT(restaurant_id) DO UPDATE SET instructions=excluded.instructions,updated_at=now()",
        [restaurant, body.instructions],
      );
      return Response.json({ ok: true });
    }
    if (
      !["apply", "undo", "reject"].includes(body.command) ||
      !Array.isArray(body.ids) ||
      body.ids.length < 1 ||
      body.ids.length > 15 ||
      !body.ids.every(isUuid)
    )
      throw new SalesError("Ação inválida.");
    const selected = (
      await query<Action>(
        "SELECT * FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND id=ANY($2::uuid[]) AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.result->>'detached_at' IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.ia_vendas_runs r WHERE r.restaurant_id=$1 AND r.id=ia_vendas_actions.run_id AND r.kind='analysis' AND (r.status<>'completed' OR r.result->'report'->>'status' IS DISTINCT FROM 'complete'))",
        [restaurant, body.ids],
      )
    ).rows;
    if (selected.length && (await query("SELECT 1 FROM public.ia_vendas_conversations WHERE restaurant_id=$1 AND kind='analysis' AND id=ANY($2::uuid[]) LIMIT 1", [restaurant, selected.map(a => a.conversation_id)])).rowCount) await requireIaPlus(restaurant);
    if (selected.length !== new Set(body.ids).size)
      throw new SalesError("Proposta não encontrada.", 404);
    if (
      body.command === "apply" &&
      selected.reduce((n, a) => n + (a.image_jobs?.length || 0), 0) > 3
    )
      throw new SalesError("Aplique um lote de imagens por vez.");
    const results = [];
    for (const id of [...new Set<string>(body.ids)]) {
      const a = selected.find((x) => x.id === id)!;
      try {
        if (body.command === "reject") {
          await query(
            "UPDATE public.ia_vendas_actions SET status='rejected' WHERE restaurant_id=$1 AND id=$2 AND status IN ('pending','failed','conflict')",
            [restaurant, id],
          );
          results.push({ id, ok: true });
          continue;
        }
        if (body.command === "undo") {
          if (a.image_jobs) {
            await withTransaction(async (c) => {
              const current = (
                await c.query(
                  "SELECT * FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND id=$2 FOR UPDATE",
                  [restaurant, id],
                )
              ).rows[0];
              if (current.status !== "applied")
                throw new SalesError("Lote indisponível.", 409);
              await c.query(
                "UPDATE public.ia_vendas_actions SET status='rejected' WHERE restaurant_id=$1 AND id=ANY($2::uuid[]) AND status IN ('pending','failed')",
                [restaurant, current.generated_actions],
              );
              await c.query(
                "UPDATE public.ia_vendas_actions SET status='undone',undone_at=now() WHERE restaurant_id=$1 AND id=$2",
                [restaurant, id],
              );
            });
          } else await execute(restaurant, id, true);
        } else if (a.status === "applied") {
          /* idempotent */
        } else if (a.image_jobs) await applyImages(restaurant, id);
        else {
          if (
            !["pending", "failed", "applying"].includes(a.status) ||
            a.attempts >= 2
          )
            throw new SalesError("Peça uma proposta atualizada.", 409);
          if (a.image) await publishImage(restaurant, a);
          await apply(restaurant, id);
        }
        results.push({ id, ok: true });
      } catch (e) {
        if (e instanceof IaPlusRequired) throw e;
        results.push({
          id,
          ok: false,
          error:
            e instanceof SalesError
              ? e.message
              : "Não foi possível concluir esta ação.",
        });
      }
    }
    return Response.json({ results });
  } catch (e) {
    return failure(e);
  }
}

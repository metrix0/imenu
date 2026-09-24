import sharp from "sharp";
import OpenAI, { toFile } from "openai";
import { randomUUID } from "crypto";
import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { imageUrl } from "./data";
import { saveFile, download, signedAttachment } from "./files";
import { beginRun, finishRun, reserveImage } from "./runs";
import { propose, claim } from "./actions";
import { MODELS, LIMITS } from "./config";
import { SalesError, object, type Data, type Action } from "./types";
import { isUuid } from "./catalog";
async function target(restaurant: string, input: Data) {
  if (
    !["item", "logo", "banner"].includes(input.target) ||
    typeof input.prompt !== "string" ||
    input.prompt.length > 3000 ||
    !input.prompt.trim()
  )
    throw new SalesError("Informe o alvo e a descrição da imagem.");
  const item = input.target === "item";
  if (item && !isUuid(input.item_id)) throw new SalesError("Produto inválido.");
  const row = (
    await query(
      item
        ? "SELECT id,name,image_path FROM public.items WHERE restaurant_id=$1 AND id=$2"
        : "SELECT id,name,logo_url,banner_url FROM public.restaurants WHERE id=$1",
      item ? [restaurant, input.item_id] : [restaurant],
    )
  ).rows[0];
  if (!row) throw new SalesError("Alvo não encontrado.");
  const field = item
      ? "image_path"
      : input.target === "logo"
        ? "logo_url"
        : "banner_url",
    bucket = item
      ? "menu-images"
      : input.target === "logo"
        ? "restaurant-logos"
        : "menu-banners";
  return { row, field, bucket, entity: item ? "items" : "restaurants" };
}
export async function previewImage(
  restaurant: string,
  conversation: string,
  run: string,
  input: Data,
): Promise<Action> {
  const t = await target(restaurant, input),
    ai = new OpenAI({ maxRetries: 0, timeout: 90000 });
  let reference: Buffer | undefined;
  if (input.attachment_id) {
    const a = await download(restaurant, input.attachment_id);
    if (!a.row.mime.startsWith("image/"))
      throw new SalesError("Anexe uma imagem de referência.");
    reference = a.bytes;
  } else if (t.row[t.field]) {
    let path = t.row[t.field];
    if (/^https:/.test(path)) {
      const own = new URL(process.env.SUPABASE_URL!);
      const url = new URL(path);
      const prefix = `/storage/v1/object/public/${t.bucket}/`;
      if (url.origin !== own.origin || !url.pathname.startsWith(prefix))
        throw new SalesError("Anexe a foto original para preservar o produto.");
      path = decodeURIComponent(url.pathname.slice(prefix.length));
    }
    const { data, error } = await createSupabaseServerClient()
      .storage.from(t.bucket)
      .download(path);
    if (error || !data) throw new SalesError("Anexe a foto original.");
    reference = Buffer.from(await data.arrayBuffer());
  }
  await reserveImage(restaurant, run);
  const prompt = `Crie uma imagem comercial realista para ${t.row.name}. ${input.target === "item" ? "Fotografia gastronômica. Preserve exatamente ingredientes, porção, quantidade e apresentação do produto de referência. Não invente acompanhamentos ou ingredientes. Sem texto sobreposto." : "Preserve a identidade da marca."} Pedido do proprietário: ${input.prompt}`;
  const args = {
    model: MODELS.image,
    prompt,
    n: 1,
    quality: "medium" as const,
    size:
      input.target === "banner"
        ? ("1536x1024" as const)
        : ("1024x1024" as const),
  };
  const result = reference
    ? await ai.images.edit({
        ...args,
        image: await toFile(await sharp(reference, {limitInputPixels: 40000000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).png().toBuffer(), "reference.png", {type:"image/png"}),
      })
    : await ai.images.generate(args);
  if (!result.data?.[0]?.b64_json)
    throw new SalesError("A imagem não foi gerada.");
  const saved = await saveFile(
    restaurant,
    `${input.target}.png`,
    "image/png",
    Buffer.from(result.data[0].b64_json, "base64"),
    "generated",
  );
  const after = `${restaurant}/ia-vendas/${saved.id}.webp`,
    before = t.row[t.field] || null;
  const current = await target(restaurant, input);
  if ((current.row[t.field] || null) !== before)
    throw new SalesError("A imagem original mudou. Peça uma nova prévia.", 409);
  const action = await propose(restaurant, conversation, run, {
    title: `Atualizar imagem: ${t.row.name}`,
    reason: "Prévia gerada. A publicação só acontece ao aplicar.",
    operations: [
      {
        entity: t.entity,
        kind: "update",
        id: t.row.id,
        values: { [t.field]: after },
      },
    ],
  });
  if ((action.operations[0].before?.[t.field] || null) !== before) {
    await query(
      "UPDATE public.ia_vendas_actions SET status='conflict',error='A imagem original mudou.' WHERE restaurant_id=$1 AND id=$2",
      [restaurant, action.id],
    );
    throw new SalesError("A imagem original mudou. Peça uma nova prévia.", 409);
  }
  const image = {
    before: imageUrl(before, t.bucket),
    attachment_id: saved.id,
    bucket: t.bucket,
    path: after,
  };
  await query(
    "UPDATE public.ia_vendas_actions SET image=$3::jsonb WHERE restaurant_id=$1 AND id=$2",
    [restaurant, action.id, JSON.stringify(image)],
  );
  return {
    ...action,
    image: {
      ...image,
      after: (await signedAttachment(restaurant, saved.id)).url,
    },
  };
}
export async function publishImage(restaurant: string, action: Action) {
  if (!action.image) return;
  const { bytes } = await download(restaurant, action.image.attachment_id);
  if (
    !["menu-images", "restaurant-logos", "menu-banners"].includes(
      action.image.bucket,
    ) ||
    !action.image.path.startsWith(`${restaurant}/ia-vendas/`)
  )
    throw new SalesError("Destino inválido.");
  const { error } = await createSupabaseServerClient()
    .storage.from(action.image.bucket)
    .upload(action.image.path, bytes, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw new SalesError("Não foi possível publicar a imagem.");
}
export async function proposeImages(
  restaurant: string,
  conversation: string,
  run: string,
  input: unknown,
) {
  const data = object(input);
  if (!Array.isArray(data.jobs) || !data.jobs.length || data.jobs.length > 3)
    throw new SalesError("Proponha até três imagens por lote.");
  const count = Number(
    (
      await query(
        "SELECT count(*) n FROM public.ia_vendas_actions WHERE restaurant_id=$1 AND run_id=$2",
        [restaurant, run],
      )
    ).rows[0].n,
  );
  if (count >= LIMITS.actions)
    throw new SalesError("Revise as propostas primeiro.");
  const jobs = [];
  for (const job of data.jobs) {
    const t = await target(restaurant, job);
    jobs.push({ ...job, label: t.row.name });
  }
  return (
    await query(
      "INSERT INTO public.ia_vendas_actions (restaurant_id,conversation_id,run_id,title,reason,image_jobs) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *",
      [
        restaurant,
        conversation,
        run,
        "Gerar prévias de imagens",
        "Aprovar gera as prévias; publicar exige nova aprovação.",
        JSON.stringify(jobs),
      ],
    )
  ).rows[0];
}
export async function applyImages(restaurant: string, id: string) {
  const action = await claim(restaurant, id);
  if (!action)
    throw new SalesError("Lote em processamento ou sem novas tentativas.", 409);
  const run = randomUUID();
  let started = false;
  try {
    await beginRun(restaurant, action.conversation_id, run, "image");
    started = true;
    const generated = action.generated_actions || [];
    for (const job of (action.image_jobs || []).slice(generated.length)) {
      const preview = await previewImage(
        restaurant,
        action.conversation_id,
        run,
        job,
      );
      generated.push(preview.id);
      await query(
        "UPDATE public.ia_vendas_actions SET generated_actions=$3 WHERE restaurant_id=$1 AND id=$2",
        [restaurant, id, generated],
      );
    }
    await query(
      "UPDATE public.ia_vendas_actions SET status='applied',applied_at=now() WHERE restaurant_id=$1 AND id=$2",
      [restaurant, id],
    );
    await finishRun(restaurant, run, { generated });
    return { id, status: "applied" };
  } catch (e) {
    if (started)
      await finishRun(restaurant, run, null, "Geração interrompida.");
    await query(
      "UPDATE public.ia_vendas_actions SET status='failed',error='O lote não foi concluído. As prévias prontas foram preservadas.' WHERE restaurant_id=$1 AND id=$2 AND status='applying'",
      [restaurant, id],
    );
    throw e;
  }
}

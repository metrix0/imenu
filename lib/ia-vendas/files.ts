import { randomUUID } from "crypto";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { query, withTransaction } from "@/lib/database/sql";
import { LIMITS, PRIVATE_BUCKET } from "./config";
import { SalesError } from "./types";

export type GeneratedImageProfile = "item" | "logo" | "banner";

const generatedProfiles = {
  item: {
    maxWidth: 500,
    maxHeight: 500,
    quality: 80,
  },
  logo: {
    maxWidth: 640,
    maxHeight: 640,
    targetBytes: 200 * 1024,
    initialQuality: 86,
    minQuality: 58,
  },
  banner: {
    maxWidth: 1920,
    maxHeight: 1080,
    targetBytes: 450 * 1024,
    initialQuality: 84,
    minQuality: 56,
  },
} as const;

export async function compressGeneratedImage(
  bytes: Buffer,
  profile: GeneratedImageProfile,
) {
  if (profile === "item") {
    const config = generatedProfiles.item;
    return sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: config.maxWidth,
        height: config.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: config.quality })
      .toBuffer();
  }

  const config =
      profile === "logo" ? generatedProfiles.logo : generatedProfiles.banner,
    metadata = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .metadata(),
    sourceWidth = metadata.width || 0,
    sourceHeight = metadata.height || 0;
  if (!sourceWidth || !sourceHeight) throw new Error("Imagem inválida.");

  const scale = Math.min(
    1,
    config.maxWidth / sourceWidth,
    config.maxHeight / sourceHeight,
  );
  let width = Math.max(1, Math.round(sourceWidth * scale)),
    height = Math.max(1, Math.round(sourceHeight * scale)),
    best: Buffer | null = null;

  for (let resizePass = 0; resizePass < 6; resizePass += 1) {
    for (
      let quality = config.initialQuality;
      quality >= config.minQuality;
      quality -= 7
    ) {
      best = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, height, fit: "fill" })
        .webp({ quality })
        .toBuffer();
      if (best.length <= config.targetBytes) return best;
    }
    if (width <= 320 || height <= 180) break;
    width = Math.max(320, Math.round(width * 0.84));
    height = Math.max(180, Math.round(height * 0.84));
  }
  if (!best) throw new Error("Falha ao comprimir a imagem.");
  return best;
}

export async function attachment(restaurant: string, id: string) {
  const row = (
    await query(
      "SELECT * FROM public.ia_vendas_attachments WHERE restaurant_id=$1 AND id=$2",
      [restaurant, id],
    )
  ).rows[0];
  if (!row) throw new SalesError("Anexo não encontrado.", 404);
  return row;
}
export async function signedAttachment(restaurant: string, id: string) {
  const row = await attachment(restaurant, id);
  const { data, error } = await createSupabaseServerClient()
    .storage.from(PRIVATE_BUCKET)
    .createSignedUrl(row.path, 3600);
  if (error) throw new SalesError("Não foi possível abrir o anexo.");
  return { id: row.id, name: row.name, mime: row.mime, url: data.signedUrl };
}
export async function download(restaurant: string, id: string) {
  const row = await attachment(restaurant, id);
  const { data, error } = await createSupabaseServerClient()
    .storage.from(PRIVATE_BUCKET)
    .download(row.path);
  if (error || !data) throw new SalesError("Não foi possível ler o anexo.");
  return { row, bytes: Buffer.from(await data.arrayBuffer()) };
}
export async function saveFile(
  restaurant: string,
  name: string,
  mime: string,
  bytes: Buffer,
  source = "upload",
  generatedProfile?: GeneratedImageProfile,
) {
  if (!bytes.length || bytes.length > LIMITS.fileBytes)
    throw new SalesError("Envie um arquivo de até 8 MB.");
  let textContent: string | null = null;
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    try {
      bytes = generatedProfile
        ? await compressGeneratedImage(bytes, generatedProfile)
        : await sharp(bytes, { limitInputPixels: 40_000_000 })
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 90 })
            .toBuffer();
      mime = "image/webp";
      name = name.replace(/\.[^.]+$/, "") + ".webp";
    } catch {
      throw new SalesError("Imagem inválida.");
    }
  } else if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new SalesError("PDF inválido.");
  } else if (["text/plain", "text/csv", "text/markdown"].includes(mime)) {
    textContent = bytes.toString("utf8");
    if (textContent.length > 100000 || textContent.includes("\0"))
      throw new SalesError("Texto inválido ou muito longo.");
  } else throw new SalesError("Use JPG, PNG, WebP, PDF, TXT, CSV ou Markdown.");
  const id = randomUUID(),
    path = `${restaurant}/${id}/${name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100)}`;
  return withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
      restaurant,
    ]);
    const used = Number(
      (
        await c.query(
          "SELECT coalesce(sum(size),0) n FROM public.ia_vendas_attachments WHERE restaurant_id=$1 AND created_at>=date_trunc('month',now())",
          [restaurant],
        )
      ).rows[0].n,
    );
    if (used + bytes.length > LIMITS.monthlyFileBytes)
      throw new SalesError("Capacidade de anexos atingida.");
    const storage = createSupabaseServerClient().storage.from(PRIVATE_BUCKET);
    const { error } = await storage.upload(path, bytes, { contentType: mime });
    if (error) throw new SalesError("Não foi possível salvar o anexo.");
    try {
      await c.query(
        "INSERT INTO public.ia_vendas_attachments (id,restaurant_id,name,mime,path,size,source,text_content) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          restaurant,
          name.slice(0, 180),
          mime,
          path,
          bytes.length,
          source,
          textContent,
        ],
      );
    } catch (e) {
      await storage.remove([path]);
      throw e;
    }
    return { id, name, mime };
  });
}

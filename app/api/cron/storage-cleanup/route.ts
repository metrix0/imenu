import { NextResponse } from "next/server";
import sharp from "sharp";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 500;
const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const MENU_IMAGE_BUCKET = "menu-images";
const MENU_ITEM_PREFIX = "menu-images";
const VISUAL_ORPHAN_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const VISUAL_OPTIMIZATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const VISUAL_OPTIMIZATION_BUDGET_MS = 210 * 1000;
const MAX_VISUAL_OPTIMIZATIONS = 200;
const VISUAL_BUCKETS = [
    { name: "restaurant-logos", referenceColumn: "logo_url", targetBytes: 200 * 1024, maxWidth: 640, maxHeight: 640 },
    { name: "menu-banners", referenceColumn: "banner_url", targetBytes: 450 * 1024, maxWidth: 1920, maxHeight: 1080 },
] as const;
type VisualBucket = (typeof VISUAL_BUCKETS)[number];

type StorageFile = {
    path: string;
    createdAt: string | null;
    updatedAt: string | null;
    size: number;
    mimeType: string | null;
};

function isAuthorized(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    return Boolean(
        cronSecret &&
            request.headers.get("authorization") === `Bearer ${cronSecret}`
    );
}

async function fetchAllRows(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    table: string,
    columns: string
): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        rows.push(...((data || []) as unknown as Record<string, unknown>[]));

        if (!data || data.length < PAGE_SIZE) break;
    }

    return rows;
}

async function listBucketFiles(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    bucket: string,
    prefix = ""
): Promise<StorageFile[]> {
    const files: StorageFile[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(prefix, {
                limit: PAGE_SIZE,
                offset,
                sortBy: { column: "name", order: "asc" },
            });

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const entry of data) {
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;
            const isFolder = !entry.id && !entry.metadata;

            if (isFolder) {
                files.push(...(await listBucketFiles(supabase, bucket, path)));
                continue;
            }

            files.push({
                path,
                createdAt: entry.created_at || null,
                updatedAt: entry.updated_at || null,
                size: Number(entry.metadata?.size || 0),
                mimeType: typeof entry.metadata?.mimetype === "string" ? entry.metadata.mimetype : null,
            });
        }

        if (data.length < PAGE_SIZE) break;
    }

    return files;
}

function decodePath(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizeStorageReference(value: unknown, bucket: string): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;

    const markers = [
        `/storage/v1/object/public/${bucket}/`,
        `/storage/v1/object/sign/${bucket}/`,
        `/storage/v1/object/authenticated/${bucket}/`,
    ];

    for (const marker of markers) {
        const index = trimmed.indexOf(marker);
        if (index >= 0) {
            return decodePath(
                trimmed.slice(index + marker.length).split(/[?#]/, 1)[0]
            );
        }
    }

    if (/^https?:\/\//i.test(trimmed)) return null;

    return decodePath(trimmed.replace(/^\/+/, ""));
}

function isReferencedByAction(path: string, actionText: string): boolean {
    return (
        actionText.includes(path) ||
        actionText.includes(encodeURI(path)) ||
        actionText.includes(encodeURIComponent(path))
    );
}


async function optimizeVisualFile(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    bucket: VisualBucket,
    file: StorageFile
): Promise<number> {
    const mimeType = file.mimeType;
    if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return 0;

    const { data, error } = await supabase.storage.from(bucket.name).download(file.path);
    if (error) throw error;
    const original = Buffer.from(await data.arrayBuffer());
    if (original.length <= bucket.targetBytes) return 0;

    const metadata = await sharp(original).metadata();
    const mimeForFormat: Record<string, string> = {
        jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    };
    if (!metadata.format || mimeForFormat[metadata.format] !== mimeType || (metadata.pages ?? 1) > 1) {
        return 0;
    }

    let best: Buffer | null = null;
    for (let pass = 0; pass < 6; pass += 1) {
        const scale = Math.pow(0.84, pass);
        const width = Math.round(bucket.maxWidth * scale);
        const height = Math.round(bucket.maxHeight * scale);
        if (width < (bucket.name === "restaurant-logos" ? 320 : 640)) break;

        for (const quality of [84, 77, 70, 63, 56]) {
            const image = sharp(original)
                .rotate()
                .resize(width, height, { fit: "inside", withoutEnlargement: true });
            const candidate = metadata.format === "jpeg"
                ? await image.jpeg({ quality, mozjpeg: true }).toBuffer()
                : metadata.format === "webp"
                  ? await image.webp({ quality }).toBuffer()
                  : await image.png({ compressionLevel: 9, palette: true, quality }).toBuffer();

            if (!best || candidate.length < best.length) best = candidate;
            if (candidate.length <= bucket.targetBytes) break;
            if (metadata.format === "png") break; // PNG quality is less meaningful than resizing.
        }
        if (best && best.length <= bucket.targetBytes) break;
    }

    // Replacing under the same key preserves restaurant references and public URLs.
    // Never replace a file with a larger image or with negligible savings.
    if (!best || best.length >= original.length * 0.9) return 0;

    const { error: uploadError } = await supabase.storage.from(bucket.name).upload(
        file.path,
        best,
        { upsert: true, contentType: mimeType, cacheControl: "31536000" }
    );
    if (uploadError) throw uploadError;
    return original.length - best.length;
}

async function cleanupAndOptimizeVisuals(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    restaurants: Record<string, unknown>[],
    actionText: string
) {
    const orphanCutoff = Date.now() - VISUAL_ORPHAN_AGE_MS;
    const optimizationCutoff = Date.now() - VISUAL_OPTIMIZATION_AGE_MS;
    const startedAt = Date.now();
    let attempts = 0;
    const results: Record<string, {
        scanned: number; deleted: number; optimized: number;
        freedBytes: number; errors: number;
    }> = {};

    for (const bucket of VISUAL_BUCKETS) {
        const files = await listBucketFiles(supabase, bucket.name);
        const references = new Set(
            restaurants
                .map((restaurant) => normalizeStorageReference(restaurant[bucket.referenceColumn], bucket.name))
                .filter((path): path is string => !!path)
        );

        const orphaned = files.filter((file) =>
            file.createdAt &&
            Date.parse(file.createdAt) < orphanCutoff &&
            !references.has(file.path) &&
            !isReferencedByAction(file.path, actionText)
        );

        let deleted = 0;
        let freedBytes = 0;
        for (let index = 0; index < orphaned.length; index += DELETE_BATCH_SIZE) {
            const batch = orphaned.slice(index, index + DELETE_BATCH_SIZE);
            const { data, error } = await supabase.storage.from(bucket.name)
                .remove(batch.map((file) => file.path));
            if (error) throw error;
            deleted += data?.length ?? batch.length;
            freedBytes += batch.reduce((sum, file) => sum + file.size, 0);
        }

        let optimized = 0;
        let errors = 0;
        const oversized = files
            .filter((file) =>
                references.has(file.path) &&
                file.size > bucket.targetBytes &&
                file.size <= 20 * 1024 * 1024 &&
                file.updatedAt &&
                Date.parse(file.updatedAt) < optimizationCutoff &&
                ["image/jpeg", "image/png", "image/webp"].includes(file.mimeType || "")
            )
            .sort((a, b) => b.size - a.size);

        for (const file of oversized) {
            if (attempts >= MAX_VISUAL_OPTIMIZATIONS ||
                Date.now() - startedAt >= VISUAL_OPTIMIZATION_BUDGET_MS) break;
            attempts += 1;
            try {
                const savings = await optimizeVisualFile(supabase, bucket, file);
                if (savings > 0) {
                    optimized += 1;
                    freedBytes += savings;
                }
            } catch (error) {
                errors += 1;
                console.warn("[storage-cleanup] Visual optimization failed", {
                    bucket: bucket.name,
                    path: file.path,
                    error,
                });
            }
        }

        results[bucket.name] = {
            scanned: files.length, deleted, optimized, freedBytes, errors,
        };
    }

    return results;
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const supabase = createSupabaseServerClient();

        const [items, itemMedia, actions, restaurants] = await Promise.all([
            fetchAllRows(supabase, "items", "image_path"),
            fetchAllRows(supabase, "item_media", "url,media_type"),
            fetchAllRows(
                supabase,
                "ia_vendas_actions",
                "operations,baseline,image,image_jobs"
            ),
            fetchAllRows(supabase, "restaurants", "logo_url,banner_url"),
        ]);

        const references = new Set<string>();

        for (const item of items) {
            const path = normalizeStorageReference(item.image_path, MENU_IMAGE_BUCKET);
            if (path) references.add(path);
        }

        for (const media of itemMedia) {
            if (media.media_type !== "image") continue;

            const path = normalizeStorageReference(media.url, MENU_IMAGE_BUCKET);
            if (path) references.add(path);
        }

        const actionText = JSON.stringify(actions);
        const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;
        const files = await listBucketFiles(supabase, MENU_IMAGE_BUCKET, MENU_ITEM_PREFIX);

        const orphaned = files.filter((file) => {
            if (!file.createdAt) return false;

            const createdAt = Date.parse(file.createdAt);
            if (!Number.isFinite(createdAt) || createdAt >= cutoff) return false;
            if (references.has(file.path)) return false;
            if (isReferencedByAction(file.path, actionText)) return false;

            return true;
        });

        let deleted = 0;

        for (
            let index = 0;
            index < orphaned.length;
            index += DELETE_BATCH_SIZE
        ) {
            const batch = orphaned
                .slice(index, index + DELETE_BATCH_SIZE)
                .map((file) => file.path);

            const { data, error } = await supabase.storage
                .from(MENU_IMAGE_BUCKET)
                .remove(batch);

            if (error) throw error;
            deleted += data?.length ?? batch.length;
        }

        const visuals = await cleanupAndOptimizeVisuals(supabase, restaurants, actionText);

        return NextResponse.json({
            cutoff: new Date(cutoff).toISOString(),
            prefix: MENU_ITEM_PREFIX,
            scanned: files.length,
            deleted,
            freedBytes: orphaned.reduce(
                (total, file) => total + file.size,
                0
            ),
            visuals,
        });
    } catch (error) {
        console.error("[storage-cleanup] Failed:", error);
        return NextResponse.json(
            { error: "Falha ao limpar arquivos órfãos." },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 500;
const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

type StorageFile = {
    path: string;
    createdAt: string | null;
    size: number;
};

type BucketConfig = {
    bucket: string;
    references: Set<string>;
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
        const { data, error } = await supabase.storage.from(bucket).list(prefix, {
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
                size: Number(entry.metadata?.size || 0),
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

function normalizeReference(value: unknown, bucket: string): string | null {
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

function addReference(
    target: Set<string>,
    value: unknown,
    bucket: string
): void {
    const path = normalizeReference(value, bucket);
    if (path) target.add(path);
}

function isReferencedByAction(path: string, actionText: string): boolean {
    return (
        actionText.includes(path) ||
        actionText.includes(encodeURI(path)) ||
        actionText.includes(encodeURIComponent(path))
    );
}

async function cleanupBucket(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    config: BucketConfig,
    actionText: string,
    cutoff: number
) {
    const files = await listBucketFiles(supabase, config.bucket);
    const orphaned = files.filter((file) => {
        if (!file.createdAt) return false;

        const createdAt = Date.parse(file.createdAt);
        if (!Number.isFinite(createdAt) || createdAt >= cutoff) return false;
        if (config.references.has(file.path)) return false;
        if (isReferencedByAction(file.path, actionText)) return false;

        return true;
    });

    let deleted = 0;

    for (let index = 0; index < orphaned.length; index += DELETE_BATCH_SIZE) {
        const batch = orphaned
            .slice(index, index + DELETE_BATCH_SIZE)
            .map((file) => file.path);

        const { data, error } = await supabase.storage
            .from(config.bucket)
            .remove(batch);

        if (error) throw error;
        deleted += data?.length ?? batch.length;
    }

    return {
        bucket: config.bucket,
        scanned: files.length,
        deleted,
        freedBytes: orphaned.reduce((total, file) => total + file.size, 0),
    };
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const supabase = createSupabaseServerClient();

        const [items, itemMedia, restaurants, actions] = await Promise.all([
            fetchAllRows(supabase, "items", "image_path"),
            fetchAllRows(supabase, "item_media", "url,media_type"),
            fetchAllRows(supabase, "restaurants", "logo_url,banner_url"),
            fetchAllRows(
                supabase,
                "ia_vendas_actions",
                "operations,baseline,image,image_jobs"
            ),
        ]);

        const menuImageReferences = new Set<string>();
        const bannerReferences = new Set<string>();
        const logoReferences = new Set<string>();

        for (const item of items) {
            addReference(menuImageReferences, item.image_path, "menu-images");
        }

        for (const media of itemMedia) {
            if (media.media_type === "image") {
                addReference(menuImageReferences, media.url, "menu-images");
            }
        }

        for (const restaurant of restaurants) {
            addReference(
                bannerReferences,
                restaurant.banner_url,
                "menu-banners"
            );
            addReference(
                logoReferences,
                restaurant.logo_url,
                "restaurant-logos"
            );
        }

        const actionText = JSON.stringify(actions);
        const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;
        const bucketConfigs: BucketConfig[] = [
            {
                bucket: "menu-images",
                references: menuImageReferences,
            },
            {
                bucket: "menu-banners",
                references: bannerReferences,
            },
            {
                bucket: "restaurant-logos",
                references: logoReferences,
            },
        ];

        const buckets = [];
        for (const config of bucketConfigs) {
            buckets.push(
                await cleanupBucket(supabase, config, actionText, cutoff)
            );
        }

        return NextResponse.json({
            cutoff: new Date(cutoff).toISOString(),
            deleted: buckets.reduce((total, bucket) => total + bucket.deleted, 0),
            freedBytes: buckets.reduce(
                (total, bucket) => total + bucket.freedBytes,
                0
            ),
            buckets,
        });
    } catch (error) {
        console.error("[storage-cleanup] Failed:", error);
        return NextResponse.json(
            { error: "Falha ao limpar arquivos órfãos." },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 500;
const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const MENU_IMAGE_BUCKET = "menu-images";
const MENU_ITEM_PREFIX = "menu-images";

type StorageFile = {
    path: string;
    createdAt: string | null;
    size: number;
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

async function listMenuItemFiles(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    prefix = MENU_ITEM_PREFIX
): Promise<StorageFile[]> {
    const files: StorageFile[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.storage
            .from(MENU_IMAGE_BUCKET)
            .list(prefix, {
                limit: PAGE_SIZE,
                offset,
                sortBy: { column: "name", order: "asc" },
            });

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const entry of data) {
            const path = `${prefix}/${entry.name}`;
            const isFolder = !entry.id && !entry.metadata;

            if (isFolder) {
                files.push(...(await listMenuItemFiles(supabase, path)));
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

function normalizeMenuImageReference(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;

    const markers = [
        `/storage/v1/object/public/${MENU_IMAGE_BUCKET}/`,
        `/storage/v1/object/sign/${MENU_IMAGE_BUCKET}/`,
        `/storage/v1/object/authenticated/${MENU_IMAGE_BUCKET}/`,
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

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const supabase = createSupabaseServerClient();

        const [items, itemMedia, actions] = await Promise.all([
            fetchAllRows(supabase, "items", "image_path"),
            fetchAllRows(supabase, "item_media", "url,media_type"),
            fetchAllRows(
                supabase,
                "ia_vendas_actions",
                "operations,baseline,image,image_jobs"
            ),
        ]);

        const references = new Set<string>();

        for (const item of items) {
            const path = normalizeMenuImageReference(item.image_path);
            if (path) references.add(path);
        }

        for (const media of itemMedia) {
            if (media.media_type !== "image") continue;

            const path = normalizeMenuImageReference(media.url);
            if (path) references.add(path);
        }

        const actionText = JSON.stringify(actions);
        const cutoff = Date.now() - MIN_ORPHAN_AGE_MS;
        const files = await listMenuItemFiles(supabase);

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

        return NextResponse.json({
            cutoff: new Date(cutoff).toISOString(),
            prefix: MENU_ITEM_PREFIX,
            scanned: files.length,
            deleted,
            freedBytes: orphaned.reduce(
                (total, file) => total + file.size,
                0
            ),
        });
    } catch (error) {
        console.error("[storage-cleanup] Failed:", error);
        return NextResponse.json(
            { error: "Falha ao limpar arquivos órfãos." },
            { status: 500 }
        );
    }
}

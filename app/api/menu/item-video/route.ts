import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { NextResponse } from "next/server";
import { RestaurantOwnerAuthError, requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { MAX_MENU_VIDEO_BYTES, MAX_MENU_VIDEO_MB, MENU_VIDEO_BUCKET, isMenuVideoType } from "@/lib/menu/itemMedia";

export const runtime = "nodejs";

const run = promisify(execFile);
const MAX_SECONDS = 30;
let activeEncodes = 0;

async function readVideo(request: Request): Promise<Buffer | null> {
    const reader = request.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) return size ? Buffer.concat(chunks, size) : null;
            size += value.byteLength;
            if (size > MAX_MENU_VIDEO_BYTES) {
                await reader.cancel();
                return null;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

export async function POST(request: Request) {
    const restaurantId = new URL(request.url).searchParams.get("restaurantId") ?? "";
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(restaurantId)) {
        return NextResponse.json({ error: "Restaurante inválido." }, { status: 400 });
    }

    const type = request.headers.get("content-type") ?? "";
    if (!isMenuVideoType(type)) {
        return NextResponse.json({ error: "Escolha um vídeo MP4, MOV ou WebM." }, { status: 415 });
    }

    try {
        await requireRestaurantOwner(request, restaurantId);
        if (!(await hasIMenuPlusAccess(restaurantId))) {
            return NextResponse.json({ error: "Vídeos no cardápio são exclusivos do iMenu Plus." }, { status: 403 });
        }
    } catch (error) {
        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[item-video] Access verification failed", error);
        return NextResponse.json({ error: "Não foi possível verificar sua sessão." }, { status: 500 });
    }

    if (Number(request.headers.get("content-length")) > MAX_MENU_VIDEO_BYTES) {
        return NextResponse.json({ error: `Escolha um vídeo de até ${MAX_MENU_VIDEO_MB} MB.` }, { status: 413 });
    }
    if (activeEncodes >= 2) {
        return NextResponse.json({ error: "Aguarde um momento e tente novamente." }, { status: 429 });
    }

    activeEncodes++;
    let directory: string | undefined;
    try {
        const source = await readVideo(request);
        if (!source) return NextResponse.json({ error: `Escolha um vídeo de até ${MAX_MENU_VIDEO_MB} MB.` }, { status: 413 });
        directory = await mkdtemp(join(tmpdir(), "imenu-video-"));
        const input = join(directory, "source");
        const output = join(directory, "menu.mp4");
        await writeFile(input, source);

        const demuxer = type === "video/webm" ? "matroska" : "mov";
        const inputOptions = ["-protocol_whitelist", "file", "-f", demuxer];
        try {
            const { stdout } = await run(ffmpegPath ?? "ffmpeg", [
                "-nostdin", "-v", "error", "-progress", "pipe:1", "-nostats",
                "-filter_threads", "1", "-threads", "1", "-max_pixels", "8847360",
                ...inputOptions, "-i", input, "-t", String(MAX_SECONDS + 1), "-map", "0:V:0", "-map_metadata", "-1",
                "-an", "-sn", "-dn",
                "-vf", "scale=w='min(iw,854)':h='min(ih,480)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
                "-fpsmax", "30", "-c:v", "libx264", "-threads", "1", "-preset", "veryfast", "-crf", "26",
                "-maxrate", "650k", "-bufsize", "1300k", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", output,
            ], { timeout: 35_000, maxBuffer: 128_000 });
            const endTimestamp = Array.from(stdout.matchAll(/^out_time_us=(\d+)\s*$/gm)).at(-1)?.[1];
            const duration = Number(endTimestamp) / 1_000_000;
            if (!Number.isFinite(duration) || duration <= 0) {
                return NextResponse.json({ error: "Não foi possível ler este vídeo." }, { status: 422 });
            }
            if (duration > MAX_SECONDS) {
                return NextResponse.json({ error: "Escolha um vídeo de até 30 segundos." }, { status: 422 });
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") throw error;
            return NextResponse.json({ error: "Não foi possível converter este vídeo. Experimente outro arquivo." }, { status: 422 });
        }

        const path = `${restaurantId}/${randomUUID()}.mp4`;
        const { error } = await createSupabaseServerClient().storage.from(MENU_VIDEO_BUCKET).upload(path, await readFile(output), {
            contentType: "video/mp4",
            cacheControl: "31536000",
            upsert: false,
        });
        if (error) throw error;

        return NextResponse.json({ path });
    } catch (error) {
        console.error("[item-video] Upload failed", error);
        return NextResponse.json({ error: "Não foi possível enviar o vídeo." }, { status: 500 });
    } finally {
        activeEncodes--;
        if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
}

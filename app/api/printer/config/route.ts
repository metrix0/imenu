import { NextResponse } from "next/server";

import printerRelease from "../../../../public/downloads/imenu-printer.json";
import legacyRelease from "../../../../public/downloads/imenu-printer-legacy.json";

function compareVersions(left: string, right: string) {
    const a = left.split(".").map(Number);
    const b = right.split(".").map(Number);
    for (let i = 0; i < 3; i += 1) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

function updatePolicy(legacy: boolean, origin: string) {
    const release = legacy ? legacyRelease : printerRelease;
    const version = /^\d+\.\d+\.\d+/.exec(release.version)?.[0] || null;
    const prefix = legacy ? "IMENU_PRINTER_LEGACY_" : "IMENU_PRINTER_";
    const configuredMinimum = process.env[`${prefix}MIN_VERSION`]?.trim();
    const minimumVersion = configuredMinimum && /^\d+\.\d+\.\d+$/.test(configuredMinimum)
        ? configuredMinimum : version;
    const forceUpdate = process.env[`${prefix}FORCE_UPDATE`] === "true" &&
        Boolean(version && minimumVersion && compareVersions(minimumVersion, version) <= 0);

    return {
        latestVersion: version,
        minimumVersion: forceUpdate ? minimumVersion : null,
        forceUpdate,
        downloadUrl: new URL(release.downloadUrl, origin).toString(),
    };
}

export const dynamic = "force-dynamic";
export function GET(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    let publicKey = key?.startsWith("sb_publishable_") || false;
    try {
        if (key?.split(".").length === 3) {
            const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
            publicKey = payload.role === "anon";
        }
        if (!url || !key || !publicKey || !["http:", "https:"].includes(new URL(url).protocol)) {
            return NextResponse.json({ error: "Printer connection unavailable" }, { status: 503 });
        }
    } catch {
        return NextResponse.json({ error: "Printer connection unavailable" }, { status: 503 });
    }
    return NextResponse.json(
        { supabaseUrl: url.replace(/\/+$/, ""), supabaseAnonKey: key, updates: updatePolicy(new URL(request.url).searchParams.get("edition") === "legacy", new URL(request.url).origin) },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
}

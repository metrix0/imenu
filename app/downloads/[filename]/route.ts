import modernTrigger from "@/.printer-release-trigger.json";
import legacyTrigger from "@/.legacy-printer-release-trigger.json";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ filename: string }> };

const INSTALLER_FILENAME = /^iMenu Impressora (Legacy )?Setup (\d+\.\d+\.\d+)\.exe$/;

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
    const { filename } = await params;
    const match = INSTALLER_FILENAME.exec(filename);
    if (!match) return new Response("Not Found", { status: 404 });

    const legacy = Boolean(match[1]);
    const version = match[2];
    const repository = legacy ? "imenu-printer-windows7-legacy" : "imenu-printer";
    const assetName = legacy
        ? "iMenu.Impressora.Legacy.Setup." + version + ".exe"
        : "iMenu-Impressora-Setup-" + version + ".exe";
    const release = legacy ? legacyTrigger : modernTrigger;

    // Prefer the publisher's exact URL: future installer filenames may differ.
    const knownPrefix = "https://github.com/metrix0/" + repository + "/releases/download/v" + version + "/";
    const target = release.version === version && release.releaseUrl.startsWith(knownPrefix)
        ? release.releaseUrl
        : knownPrefix + assetName;

    return new Response(null, {
        status: 307,
        headers: { Location: target, "Cache-Control": "no-store" },
    });
}

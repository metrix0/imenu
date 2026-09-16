import { createHash } from "node:crypto";

const FIXIE_ENV_NAMES = [
    "FIXIE_URL",
    "FIXIE_URL_2",
    "FIXIE_URL_3",
    "FIXIE_URL_4",
    "FIXIE_URL_5",
] as const;

export function selectFixieUrl(selectionKey: string): string | null {
    const urls = FIXIE_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(
        (url): url is string => Boolean(url)
    );

    if (urls.length === 0) return null;

    const digest = createHash("sha256").update(selectionKey).digest();
    const index = digest.readUInt32BE(0) % urls.length;
    return urls[index];
}

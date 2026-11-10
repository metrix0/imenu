import { readFile } from "node:fs/promises";

const host = "www.imenuapp.com.br";
const site = `https://${host}`;
const dryRun = process.argv.includes("--dry-run");
const urls = [...new Set(process.argv.slice(2).filter(value => value !== "--dry-run"))];

if (!urls.length) {
    console.error(`Usage: node scripts/indexnow.mjs ${site}/updated-page [...]`);
    process.exit(1);
}

for (const url of urls) {
    try {
        const parsed = new URL(url);
        if (parsed.origin !== site || parsed.username || parsed.password || parsed.hash) {
            throw new Error("not a canonical page URL");
        }
    } catch {
        console.error(`Invalid URL for ${host}: ${url}`);
        process.exit(1);
    }
}

if (urls.length > 10000) {
    console.error("IndexNow accepts at most 10,000 URLs per request.");
    process.exit(1);
}

const key = (await readFile(new URL("../public/indexnow-key.txt", import.meta.url), "utf8")).trim();
if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    throw new Error("Invalid IndexNow verification key.");
}

const payload = {
    host,
    key,
    keyLocation: `${site}/indexnow-key.txt`,
    urlList: urls,
};

if (dryRun) {
    console.log(`IndexNow dry run: ${urls.length} URL(s) validated; no request sent.`);
} else {
    const response = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
    });
    console.log(`IndexNow: HTTP ${response.status} (${urls.length} URL(s))`);
    if (!response.ok) process.exitCode = 1;
}

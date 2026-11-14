import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { calculateDistanceKm, type Coordinates } from "../api/geocodingBase";
import { normalizeNeighborhoodName } from "./neighborhood";

const directory = () => process.env.IMENU_CNEFE_DIRECTORY || "/var/lib/imenu/cnefe";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const streetTypes = /^(?:rua|avenida|travessa|estrada|rodovia|praca|alameda|largo|viela|beco) /;
const streetAliases: Record<string, string> = {
    r: "rua", av: "avenida", dr: "doutor", drs: "doutores", dra: "doutora",
    tv: "travessa", estr: "estrada", rod: "rodovia",
};
const states = "RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF".split(" ");
const maximumPoints = 10_000;

type Municipalities = Record<string, Record<string, number>>;
type Address = { city: string; uf: string; street: string; bairro: string; number: string; cep: string };
type IndexedPoint = { lat: number; lon: number; number: string; cep: number };

export type CnefeMatch = {
    point: Coordinates;
    range: { min: number; max: number };
};

async function readMunicipalities(root: string): Promise<Municipalities> {
    return JSON.parse(await readFile(join(root, "municipalities.json"), "utf8"));
}

export async function lookupCnefe(address: Address, origin: Coordinates): Promise<CnefeMatch | null> {
    const root = directory();
    if (!states.includes(address.uf)) return null;
    const cityName = normalize(address.city);
    const street = normalize(address.street).split(" ").map(word => streetAliases[word] || word).join(" ");
    const bairro = normalizeNeighborhoodName(address.bairro);
    if (!cityName || !street || !bairro) return null;

    let db: DatabaseSync | undefined;
    try {
        const municipalities = await readMunicipalities(root);
        const city = municipalities[address.uf]?.[cityName];
        if (!Number.isInteger(city)) return null;
        db = new DatabaseSync(join(root, address.uf + ".sqlite"), { readOnly: true });
        const select = db.prepare(
            "SELECT lat, lon, number, cep FROM points WHERE city = ? AND street = ? AND bairro = ? LIMIT ?",
        );
        let points = select.all(city, street, bairro, maximumPoints + 1) as IndexedPoint[];
        if (!points.length && !streetTypes.test(street)) {
            const names = ["rua", "avenida", "travessa", "estrada", "rodovia", "praca", "alameda", "largo", "viela", "beco"];
            for (const type of names) {
                const candidate = select.all(city, `${type} ${street}`, bairro, maximumPoints + 1) as IndexedPoint[];
                if (!candidate.length) continue;
                if (points.length) return null;
                points = candidate;
            }
        }
        if (!points.length || points.length > maximumPoints) return null;

        const number = normalize(address.number).replace(/ /g, "").replace(/^0+(?=\d)/, "");
        const exact = number ? points.filter(point => point.number === number) : [];
        const postal = address.cep ? exact.filter(point => point.cep === Number(address.cep)) : [];
        const matches = postal.length ? postal : exact.length ? exact : points;
        let min = Infinity;
        let max = -Infinity;
        const distances = matches.map(row => {
            const point = { latitude: row.lat / 1_000_000, longitude: row.lon / 1_000_000 };
            const distance = calculateDistanceKm(origin.latitude, origin.longitude, point.latitude, point.longitude);
            min = Math.min(min, distance);
            max = Math.max(max, distance);
            return { point, distance };
        });
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        const midpoint = (min + max) / 2;
        const representative = distances.reduce((best, candidate) =>
            Math.abs(candidate.distance - midpoint) < Math.abs(best.distance - midpoint) ? candidate : best);
        return { point: representative.point, range: { min, max } };
    } catch {
        return null;
    } finally {
        db?.close();
    }
}

export async function checkCnefe() {
    const root = directory();
    const operation = "Geocodificação local";
    const observed = (state: "connected" | "degraded" | "failed", detail: string) =>
        ({ state, detail, operation, checkedAt: new Date().toISOString(), status: null });
    try {
        const municipalities = await readMunicipalities(root);
        const count = states.reduce((total, uf) => total + Object.keys(municipalities[uf] || {}).length, 0);
        const files = new Set(await readdir(root));
        const available = states.filter(uf => files.has(uf + ".sqlite"));
        if (!available.length) return observed("failed", "Nenhum índice estadual disponível.");
        const checked = available.filter(uf => {
            let db: DatabaseSync | undefined;
            try {
                db = new DatabaseSync(join(root, uf + ".sqlite"), { readOnly: true });
                return Boolean(db.prepare("SELECT 1 FROM points LIMIT 1").get());
            } catch {
                return false;
            } finally {
                db?.close();
            }
        }).length;
        const detail = `${checked}/27 UFs disponíveis · ${count.toLocaleString("pt-BR")} municípios no catálogo.`;
        return observed(checked === 27 && count === 5570 ? "connected" : checked ? "degraded" : "failed", detail);
    } catch {
        return observed("failed", "Base CNEFE indisponível.");
    }
}

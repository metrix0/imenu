import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { checkCnefe, lookupCnefe } from "./cnefe";

const address = {
    city: "Erechim", uf: "RS", street: "José Demoliner", bairro: "Bairro Demoliner",
    number: "148", cep: "99702609",
};
const origin = { latitude: -27.6402584, longitude: -52.2972858 };
const previousDirectory = process.env.IMENU_CNEFE_DIRECTORY;
let directory: string;

beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "imenu-cnefe-test-"));
    process.env.IMENU_CNEFE_DIRECTORY = directory;
    await writeFile(join(directory, "municipalities.json"), '{"RS":{"erechim":4307005}}');
    const db = new DatabaseSync(join(directory, "RS.sqlite"));
    try {
        db.exec(`
            CREATE TABLE points (city INTEGER, street TEXT, bairro TEXT, number TEXT, cep INTEGER, lat INTEGER, lon INTEGER);
            INSERT INTO points VALUES
                (4307005, 'rua jose demoliner', 'demoliner', '570', 99704735, -27612958, -52225898),
                (4307005, 'rua jose demoliner', 'demoliner', '558', 99704735, -27611809, -52225497),
                (4307005, 'rua jose demoliner', 'centro', '148', 99702609, -27640000, -52280000),
                (4307000, 'rua jose demoliner', 'demoliner', '148', 99702609, -27640000, -52280000);
        `);
    } finally {
        db.close();
    }
});

afterEach(async () => {
    if (previousDirectory === undefined) delete process.env.IMENU_CNEFE_DIRECTORY;
    else process.env.IMENU_CNEFE_DIRECTORY = previousDirectory;
    await rm(directory, { recursive: true, force: true });
});

test("looks up the requested city, street and bairro despite a differing CEP", async () => {
    const match = await lookupCnefe(address, origin);
    expect(match?.range.min).toBeGreaterThan(7);
    expect(match?.range.max).toBeLessThan(8);
    expect(match?.range.min).toBeLessThan(match!.range.max);
});

test("prefers an exact number in the matching bairro", async () => {
    const match = await lookupCnefe({ ...address, number: "570" }, origin);
    expect(match?.point).toEqual({ latitude: -27.612958, longitude: -52.225898 });
    expect(match?.range.min).toBe(match?.range.max);
});

test("rejects another bairro and reports partial coverage", async () => {
    expect(await lookupCnefe({ ...address, bairro: "Outro" }, origin)).toBeNull();
    expect(await checkCnefe()).toMatchObject({ state: "degraded", detail: expect.stringContaining("1/27") });
    await rm(join(directory, "RS.sqlite"));
    expect(await checkCnefe()).toMatchObject({ state: "failed" });
});

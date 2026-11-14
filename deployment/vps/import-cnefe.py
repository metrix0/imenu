#!/usr/bin/env python3
"""Build read-only municipal address indexes from the IBGE CNEFE 2022 CSVs."""
import argparse
import concurrent.futures
import csv
import io
import json
import re
import shutil
import sqlite3
import tempfile
import time
import unicodedata
import urllib.request
from urllib.parse import unquote
import zipfile
from pathlib import Path

SOURCE = ("https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/"
          "Censo_Demografico_2022/Arquivos_CNEFE/CSV")
STATES = dict(zip(
    "RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF".split(),
    "11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53".split(),
))
STREET_ALIASES = {"r": "rua", "av": "avenida", "dr": "doutor", "drs": "doutores",
                  "dra": "doutora", "tv": "travessa", "estr": "estrada", "rod": "rodovia"}
WORDS = re.compile(r"[^a-z0-9]+")
BAIRRO_ALIASES = {"jd": "jardim", "jdim": "jardim", "vl": "vila", "pq": "parque",
                  "pque": "parque", "res": "residencial", "resid": "residencial",
                  "cj": "conjunto", "conj": "conjunto", "st": "setor"}


def normalize(value):
    if not value.isascii():
        value = "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))
    return WORDS.sub(" ", value.lower()).strip()


def street_name(row):
    words = normalize(" ".join(row[key] for key in ("NOM_TIPO_SEGLOGR", "NOM_TITULO_SEGLOGR", "NOM_SEGLOGR")))
    return " ".join(STREET_ALIASES.get(word, word) for word in words.split())


def download(url, file):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as source, file.open("wb") as target:
                shutil.copyfileobj(source, target)
            return
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def build_state(root, uf, code):
    target = root / f"{uf}.sqlite"
    if target.is_file():
        return
    print(f"{uf}: baixando e indexando", flush=True)
    with tempfile.TemporaryDirectory(prefix=f".{uf}-", dir=root) as tmp:
        tmp = Path(tmp)
        archive = tmp / "state.zip"
        database = tmp / "state.sqlite"
        download(f"{SOURCE}/UF/{code}_{uf}.zip", archive)
        with sqlite3.connect(database) as db, zipfile.ZipFile(archive) as zipped:
            db.executescript("""
                PRAGMA journal_mode=OFF;
                PRAGMA synchronous=OFF;
                PRAGMA temp_store=FILE;
                CREATE TABLE points (
                    city INTEGER NOT NULL, street TEXT NOT NULL, bairro TEXT NOT NULL,
                    number TEXT NOT NULL, cep INTEGER NOT NULL, lat INTEGER NOT NULL, lon INTEGER NOT NULL,
                    PRIMARY KEY (city, street, bairro, number, cep, lat, lon)
                ) WITHOUT ROWID;
                PRAGMA user_version=1;
            """)
            insert = "INSERT OR IGNORE INTO points VALUES (?, ?, ?, ?, ?, ?, ?)"
            batch = []
            for name in zipped.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with zipped.open(name) as stream:
                    for row in csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"), delimiter=";"):
                        if not row["NOM_SEGLOGR"] or not row["DSC_LOCALIDADE"]:
                            continue
                        try:
                            city = int(row["COD_MUNICIPIO"])
                            lat = float(row["LATITUDE"])
                            lon = float(row["LONGITUDE"])
                            number = int(row["NUM_ENDERECO"] or 0)
                        except ValueError:
                            continue
                        if not (-34 <= lat <= 6 and -74 <= lon <= -28):
                            continue
                        suffix = normalize(row["DSC_MODIFICADOR"])
                        house = (str(number) + (suffix if re.fullmatch("[a-z]", suffix) else "")) if number > 0 else ""
                        cep = row["CEP"]
                        bairro = normalize(row["DSC_LOCALIDADE"]).removeprefix("bairro ")
                        bairro = " ".join(BAIRRO_ALIASES.get(word, word) for word in bairro.split())
                        batch.append((city, street_name(row), bairro, house,
                                      int(cep) if cep.isascii() and cep.isdigit() else 0,
                                      round(lat * 1_000_000), round(lon * 1_000_000)))
                        if len(batch) >= 20_000:
                            db.executemany(insert, sorted(batch))
                            batch.clear()
            db.executemany(insert, sorted(batch))
            if db.execute("SELECT 1 FROM points LIMIT 1").fetchone() is None:
                raise ValueError(f"{uf}: nenhuma coordenada importada")
        database.chmod(0o644)
        database.replace(target)
        print(f"{uf}: {target.stat().st_size:,} bytes", flush=True)


def build_municipalities(root):
    target = root / "municipalities.json"
    if target.is_file():
        return
    municipalities = {}
    def read_state(item):
        uf, code = item
        # Match the published municipal filenames and keep the census geography.
        with tempfile.TemporaryDirectory(dir=root) as tmp:
            listing = Path(tmp) / "municipalities.html"
            download(f"{SOURCE}/Municipio/{code}_{uf}/", listing)
            names = re.findall(r'href="(\d{7})_([^"/]+)\.zip"', listing.read_text(encoding="latin-1"))
        if not names:
            raise ValueError(f"{uf}: lista de municípios indisponível")
        return uf, {normalize(unquote(name)): int(city) for city, name in names}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
        municipalities.update(workers.map(read_state, STATES.items()))
    if sum(map(len, municipalities.values())) != 5570:
        raise ValueError("Lista nacional CNEFE 2022 incompleta")
    tmp = target.with_suffix(".tmp")
    tmp.write_text(json.dumps(municipalities, separators=(",", ":")), encoding="utf-8")
    tmp.chmod(0o644)
    tmp.replace(target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--uf", nargs="+", choices=STATES)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    build_municipalities(args.directory)
    failed = []
    for uf in args.uf or ["RS", *[uf for uf in STATES if uf != "RS"]]:
        try:
            build_state(args.directory, uf, STATES[uf])
        except (OSError, ValueError, sqlite3.Error, zipfile.BadZipFile) as error:
            failed.append(uf)
            print(f"{uf}: {error}", flush=True)
    if failed:
        raise SystemExit("Importação incompleta: " + ", ".join(failed))


if __name__ == "__main__":
    main()

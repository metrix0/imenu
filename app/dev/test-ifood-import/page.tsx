"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ImportarIFoodJSON() {
    const [jsonInput, setJsonInput] = useState("");
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    function handleImport() {
        setError(null);

        try {
            const parsed = JSON.parse(jsonInput);

            // Ensure we find the correct data root
            const dataRoot =
                parsed?.data?.menu ||
                parsed?.data?.catalog?.groups ||
                parsed?.menu ||
                parsed?.catalog?.groups ||
                parsed;

            if (!dataRoot) {
                setError("Formato de JSON inválido ou não identificado.");
                return;
            }

            const normalized = normalizeIFoodJSON(parsed);

            setResult(normalized);
        } catch (e: any) {
            setError("JSON inválido. Erro: " + e.message);
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Importar JSON do iFood</h1>

            <p className="text-gray-600">
                1. Abra a página https://cw-marketplace.ifood.com.br/v1/bm/merchants/2f1a0cf2-3196-427e-b6d8-eab017b10ed3/catalog JSON após completar o desafio <br/>
                2. Copie TUDO (Ctrl + A → Ctrl + C) <br/>
                3. Cole aqui embaixo
            </p>

            <textarea
                className="w-full h-64 p-3 border rounded bg-gray-50 font-mono text-sm"
                placeholder="Cole aqui o JSON do iFood..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
            />

            <Button variant="primary" onClick={handleImport}>
                Importar JSON
            </Button>

            {error && (
                <p className="text-red-600 font-medium">{error}</p>
            )}

            {result && (
                <div className="bg-gray-100 p-4 rounded max-h-[400px] overflow-auto">
                    <h2 className="font-bold text-xl mb-2">Resultado Normalizado:</h2>
                    <pre className="text-sm">
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ----------------------------------------------------------
   FULL NORMALIZER — Converts ALL iFood structures into:

   [
     {
       nome: "Categoria",
       itens: [
         {
           nome: "",
           desc: "",
           preco: 19.90,
           img: "",
           modifiers: [...]
         }
       ]
     }
   ]
----------------------------------------------------------- */

function normalizeIFoodJSON(raw: any) {
    let menuGroups =
        raw?.data?.menu ||
        raw?.data?.catalog?.groups ||
        raw?.catalog?.groups ||
        raw?.menu ||
        raw;

    const categoriasOut: any[] = [];

    // Case 1 — structure: data.menu[...]
    if (Array.isArray(raw?.data?.menu)) {
        raw.data.menu.forEach((cat: any) => {
            categoriasOut.push({
                nome: cat.name || cat.title || "Categoria",
                itens: (cat.itens || []).map(normalizeItem)
            });
        });
        return categoriasOut;
    }

    // Case 2 — structure: catalog.groups
    if (Array.isArray(menuGroups)) {
        menuGroups.forEach((group: any) => {
            categoriasOut.push({
                nome: group.name || group.title || "Categoria",
                itens: (group.items || group.itens || []).map(normalizeItem)
            });
        });
        return categoriasOut;
    }

    return categoriasOut;
}

function normalizeItem(item: any) {
    // price
    let preco = null;
    if (item.unitPrice != null) preco = item.unitPrice;
    if (item.price?.value != null) preco = item.price.value / 100;
    if (typeof item.price === "number") preco = item.price;

    // image
    const img =
        item.logoUrl ||
        item.imageUrl ||
        item.img ||
        item.images?.[0]?.url ||
        "";

    const modifiers =
        item.choices?.map((choice: any) => ({
            nome: choice.name,
            min: choice.min,
            max: choice.max,
            opcoes: choice.garnishItens?.map((op: any) => ({
                nome: op.description,
                preco: op.unitPrice || 0,
                img: op.logoUrl || ""
            }))
        })) || [];

    return {
        nome: item.description || item.name || item.title || "",
        desc: item.details || item.description || "",
        preco,
        img,
        modifiers
    };
}

"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export default function EditSubitemClient({
    restauranteId,
    menuId,
    itemId,
    subcatId,
    subitem,
}: {
    restauranteId: string;
    menuId: string;
    itemId: string;
    subcatId: string;
    subitem: any;
}) {
    const router = useRouter();
    const [name, setName] = useState(subitem.name ?? "");
    const [description, setDescription] = useState(subitem.description ?? "");
    const [price, setPrice] = useState(((subitem.price_cents ?? 0) / 100).toFixed(2));
    const [isAvailable, setIsAvailable] = useState<boolean>(!!subitem.is_available);
    const [saving, setSaving] = useState(false);

    function onPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value.replace(/,/g, "");
        if (/^\d*(\.\d{0,2})?$/.test(cleaned)) setPrice(cleaned);
    }
    function onPriceBlur() {
        if (!price) return;
        const num = Number(price);
        if (!Number.isNaN(num)) setPrice(num.toFixed(2));
    }
    function parsePriceToCents(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    async function handleSave(e?: React.FormEvent) {
        e?.preventDefault();
        if (!name.trim()) return alert("Nome obrigatório");
        const cents = parsePriceToCents(price);
        if (cents === null) return alert("Preço inválido");

        setSaving(true);
        try {
            const { error } = await supabase
                .from("subitems")
                .update({ name: name.trim(), description: description.trim() || null, price_cents: cents, is_available: isAvailable })
                .eq("id", subitem.id);

            if (error) {
                console.error("Erro ao salvar subitem:", error);
                alert("Erro ao salvar subitem. Veja console.");
                return;
            }

            router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}/subcategory/${subcatId}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Editar subitem</h1>

            <form onSubmit={handleSave} className="bg-white p-6 rounded shadow border">
                <label className="block mb-2 font-semibold">Nome</label>
                <input className="w-full border rounded px-3 py-2 mb-3" value={name} onChange={(e) => setName(e.target.value)} />

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea className="w-full border rounded px-3 py-2 mb-3" value={description} onChange={(e) => setDescription(e.target.value)} />

                <label className="inline-flex items-center gap-2 mb-3">
                    <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
                    <span>{isAvailable ? "Disponível" : "Indisponível"}</span>
                </label>

                <label className="block mb-2 font-semibold">Preço (R$)</label>
                <input className="w-40 border rounded px-3 py-2 mb-4" value={price} onChange={onPriceChange} onBlur={onPriceBlur} placeholder="12.50" />

                <div className="flex gap-3">
                    <button disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">{saving ? "Salvando..." : "Salvar"}</button>
                    <button type="button" onClick={() => router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}/subcategory/${subcatId}`)} className="px-3 py-2 rounded border">Cancelar</button>
                </div>
            </form>
        </div>
    );
}

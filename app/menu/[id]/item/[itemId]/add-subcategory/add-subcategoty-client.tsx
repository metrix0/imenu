// app/menu/[id]/item/[itemId]/add-subcategory/AddSubcategoryClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

type ItemShape = { id: string; name?: string } | null;

export default function AddSubcategoryClient({
    menuId,
    item,
}: {
    menuId: string;
    item: ItemShape;
}) {
    const router = useRouter();

    const itemId = item?.id ?? "";

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [minSelect, setMinSelect] = useState<number>(0);
    const [maxSelect, setMaxSelect] = useState<number>(1);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showCreatedModal, setShowCreatedModal] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);

    function validate() {
        setError(null);
        if (!name.trim()) return setError("Nome da subcategoria é obrigatório."), false;
        if (minSelect < 0) return setError("Mínimo não pode ser negativo."), false;
        if (maxSelect < 0) return setError("Máximo não pode ser negativo."), false;
        if (maxSelect < minSelect) return setError("Máximo deve ser >= mínimo."), false;
        return true;
    }

    async function handleSave(e?: React.FormEvent) {
        e?.preventDefault();
        if (!validate()) return;
        if (!itemId) return setError("Item inválido (itemId ausente).");

        setSaving(true);
        try {
            const payload = {
                item_id: itemId,
                name: name.trim(),
                description: description.trim() || null,
                min_select: minSelect,
                max_select: maxSelect,
            };

            const { data, error } = await supabase
                .from("item_subcategories")
                .insert([payload])
                .select("id")
                .single();

            if (error) {
                console.error("Erro ao criar subcategoria:", error);
                setError("Erro ao criar subcategoria. Veja console.");
                return;
            }

            setCreatedId(data?.id ?? null);
            setShowCreatedModal(true);
        } finally {
            setSaving(false);
        }
    }

    function goAddSubitem() {
        if (!menuId || !itemId || !createdId) {
            router.push(`/menu/${menuId}/item/${itemId}`);
            return;
        }
        router.push(`/menu/${menuId}/item/${itemId}/subcategory/${createdId}/add-subitem`);
    }

    return (
        <div className="p-6 max-w-3xl">
            <h1 className="text-2xl font-bold mb-6">
                Adicionar subcategoria {item?.name ? `— ${item.name}` : ""}
            </h1>

            <form onSubmit={handleSave} className="bg-white p-6 rounded shadow border">
                <h2 className="text-lg font-semibold mb-4">Criar subcategoria</h2>

                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-3"
                />

                <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-3"
                />

                <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Mínimo</label>
                        <input
                            type="number"
                            min={0}
                            value={minSelect}
                            onChange={(e) => setMinSelect(Number(e.target.value))}
                            className="w-full border rounded px-3 py-2"
                        />
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Máximo</label>
                        <input
                            type="number"
                            min={0}
                            value={maxSelect}
                            onChange={(e) => setMaxSelect(Number(e.target.value))}
                            className="w-full border rounded px-3 py-2"
                        />
                    </div>
                </div>

                {error && <div className="text-red-600 mb-3">{error}</div>}

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                        {saving ? "Salvando..." : "Salvar subcategoria"}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push(`/menu/${menuId}/item/${itemId}`)}
                        className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
                    >
                        Cancelar
                    </button>
                </div>
            </form>

            {/* modal simples de criada */}
            {showCreatedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-3">Subcategoria criada</h3>
                        <p className="mb-4">A subcategoria foi criada com sucesso.</p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreatedModal(false);
                                    router.push(`/menu/${menuId}/item/${itemId}`);
                                }}
                                className="px-3 py-1 rounded border"
                            >
                                Voltar ao item
                            </button>

                            <button onClick={goAddSubitem} className="px-3 py-1 rounded bg-blue-600 text-white">
                                Adicionar Item Complementar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

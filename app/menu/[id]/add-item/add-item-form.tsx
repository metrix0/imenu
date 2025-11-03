"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Category = { id: string; name: string };

type Props = {
    menuId: string;
    restaurantId: string;
    categories: Category[];
};

export default function AddItemForm({
    menuId,
    restaurantId,
    categories: initialCategories
}: Props) {
    const router = useRouter();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
    const [isAvailable, setIsAvailable] = useState(true);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const [categories, setCategories] = useState(initialCategories);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [saving, setSaving] = useState(false);

    function fileToBase64(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) {
            setPreviewUrl(null);
            setImageBase64(null);
            return;
        }

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        try {
            setImageBase64(await fileToBase64(file));
        } catch {
            alert("Erro ao processar imagem");
            setImageBase64(null);
        }
    }

    function onPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value.replace(/,/g, "");
        if (/^\d*(\.\d{0,2})?$/.test(cleaned)) setPrice(cleaned);
    }

    function onPriceBlur() {
        if (!price) return;
        const num = Number(price);
        if (!isNaN(num)) setPrice(num.toFixed(2));
    }

    function parsePriceToCents(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    // ✅ Criar categoria direto pelo Supabase (igual editar item)
    async function handleCreateCategory() {
        const trimmed = newCategoryName.trim();
        if (!trimmed) return alert("Nome inválido");

        setCreatingCategory(true);

        const { data, error } = await supabase
            .from("categories")
            .insert([{ restaurant_id: restaurantId, name: trimmed }])
            .select("id, name")
            .single();

        if (error) {
            console.error("Erro ao criar categoria:", error);
            alert("Erro ao criar categoria.");
            setCreatingCategory(false);
            return;
        }

        setCategories((prev) => [...prev, data]);
        setCategoryId(data.id);
        setShowNewCategory(false);
        setNewCategoryName("");
        setCreatingCategory(false);
    }

    async function handleSave() {
        if (!name.trim()) return alert("Nome obrigatório");
        if (!price) return alert("Preço inválido");

        const cents = parsePriceToCents(price);
        if (!cents) return alert("Preço inválido");
        if (!categoryId) return alert("Selecione uma categoria");

        setSaving(true);

        const res = await fetch("/api/menu/insert-item", {
            method: "POST",
            body: JSON.stringify({
                menuId,
                restaurantId,
                categoryId,
                name,
                description,
                price_cents: cents,
                is_available: isAvailable,
                imageBase64
            })
        });

        const json = await res.json();

        if (!res.ok) {
            console.error("Erro ao salvar item:", json);
            alert("Erro ao salvar item");
            setSaving(false);
            return;
        }

        router.push(`/menu/${menuId}`);
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white p-6 rounded-lg shadow border">

                <label className="block mb-2 font-semibold">Nome</label>
                <input
                    className="w-full border rounded px-3 py-2 mb-4"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold">Categoria</label>
                    <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="text-sm text-blue-600 underline"
                    >
                        + Nova categoria
                    </button>
                </div>

                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-4"
                >
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea
                    className="w-full border rounded px-3 py-2 mb-4"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <label className="block mb-2 font-semibold">Preço (R$)</label>
                <input
                    className="w-40 border rounded px-3 py-2 mb-4"
                    value={price}
                    onChange={onPriceChange}
                    onBlur={onPriceBlur}
                    placeholder="25.50"
                />

                <label className="block mb-2 font-semibold">Imagem</label>
                <input type="file" accept="image/*" onChange={onFileChange} />
                {previewUrl && (
                    <img src={previewUrl} className="w-32 h-32 mt-3 rounded object-cover" />
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                        {saving ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                        onClick={() => router.push(`/menu/${menuId}`)}
                        className="bg-gray-200 px-4 py-2 rounded"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            {showNewCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Criar nova categoria</h3>

                        <input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="w-full border rounded px-3 py-2 mb-4"
                            placeholder="Nome da categoria"
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowNewCategory(false);
                                    setNewCategoryName("");
                                }}
                                className="px-3 py-1 rounded border"
                                disabled={creatingCategory}
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={handleCreateCategory}
                                className="px-3 py-1 rounded bg-blue-600 text-white"
                                disabled={creatingCategory}
                            >
                                {creatingCategory ? "Criando..." : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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

export default function AddItemForm({ menuId, restaurantId, categories: initialCategories }: Props) {
    const router = useRouter();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [categoryId, setCategoryId] = useState(initialCategories[0]?.id);
    const [isAvailable, setIsAvailable] = useState(true);

    // imagem base64
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const [categories, setCategories] = useState(initialCategories);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [saving, setSaving] = useState(false);
    const [creatingCategory, setCreatingCategory] = useState(false);

    useEffect(() => {
        setCategories(initialCategories);
        if (!categoryId && initialCategories[0]) setCategoryId(initialCategories[0].id);
    }, [initialCategories]);

    async function fileToBase64(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file); // encode to base64
        });
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] ?? null;
        setFile(f);

        if (!f) {
            setPreviewUrl(null);
            setImageBase64(null);
            return;
        }

        const url = URL.createObjectURL(f);
        setPreviewUrl(url);

        fileToBase64(f).then(setImageBase64).catch(() => {
            alert("Erro ao processar imagem");
            setImageBase64(null);
        });
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

    function priceIsValid(p: string) {
        return /^\d+(\.\d{2})$/.test(p);
    }

    async function handleCreateCategory() {
        const nameTrim = newCategoryName.trim();
        if (!nameTrim) return alert("Nome inválido");
        setCreatingCategory(true);

        const { data, error } = await supabase
            .from("categories")
            .insert([{ restaurant_id: restaurantId, name: nameTrim }])
            .select("id, name")
            .single();

        if (error) return alert("Erro ao criar categoria");

        setCategories((prev) => [...prev, data]);
        setCategoryId(data.id);
        setShowNewCategory(false);
        setNewCategoryName("");
        setCreatingCategory(false);
    }

    function parsePriceToCents(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    async function handleSave() {
        if (!name.trim()) return alert("Nome obrigatório");
        if (!price || !priceIsValid(price)) return alert("Preço inválido");
        if (!categoryId) return alert("Selecione categoria");

        const priceCents = parsePriceToCents(price);
        if (priceCents === null) return alert("Erro no preço");

        setSaving(true);
        try {
            // 1) Insert item
            const { data: itemData, error: itemErr } = await supabase
                .from("items")
                .insert([
                    {
                        restaurant_id: restaurantId,
                        category_id: categoryId,
                        name,
                        description: description || null,
                        price_cents: priceCents,
                        is_available: isAvailable,
                        image_path: imageBase64 || null // <-- salva imagem no items também
                    }
                ])
                .select("id")
                .single();


            if (itemErr) throw itemErr;

            const itemId = itemData.id;

            // 2) Link item to menu
            await supabase.from("menu_items").insert([
                { menu_id: menuId, item_id: itemId }
            ]);

            // 3) Save image Base64 in item_media (if exists)
            if (imageBase64) {
                await supabase.from("item_media").insert([
                    {
                        item_id: itemId,
                        media_type: "image",
                        url: imageBase64
                    }
                ]);
            }

            router.push(`/menu/${menuId}`);
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar item");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white p-6 rounded-lg shadow border">

                <label className="block mb-2 font-semibold">Nome</label>
                <input className="w-full border rounded px-3 py-2 mb-4"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <label className="block mb-2 font-semibold">Categoria</label>
                <select className="w-full border rounded px-3 py-2 mb-4"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea className="w-full border rounded px-3 py-2 mb-4"
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

                <label className="block mb-2 font-semibold">Imagem (opcional)</label>
                <input type="file" accept="image/*" onChange={onFileChange} />
                {previewUrl && <img src={previewUrl} className="w-32 h-32 mt-2 rounded object-cover" />}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                        {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button onClick={() => router.push(`/menu/${menuId}`)} className="bg-gray-200 px-4 py-2 rounded">
                        Cancelar
                    </button>
                </div>

            </div>
        </div>
    );
}

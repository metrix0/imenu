"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Category = { id: string; name: string };
type ItemShape = {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_path: string | null;
    is_available: boolean;
    position: number;
    category_id?: string | null;
};

type Props = {
    menuId: string;
    restaurantId: string;
    item: ItemShape;
    categories: Category[];
};

export default function EditItemForm({
    menuId,
    restaurantId,
    item,
    categories: initialCategories,
}: Props) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [name, setName] = useState(item.name ?? "");
    const [description, setDescription] = useState(item.description ?? "");
    const [price, setPrice] = useState(((item.price_cents ?? 0) / 100).toFixed(2));
    const [categoryId, setCategoryId] = useState<string | undefined>(
        item.category_id ?? initialCategories[0]?.id
    );
    const [isAvailable, setIsAvailable] = useState<boolean>(!!item.is_available);

    const [previewUrl, setPreviewUrl] = useState<string | null>(item.image_path ?? null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [imageDeleted, setImageDeleted] = useState(false);
    const originalImagePath = item.image_path ?? null;

    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);

    const [saving, setSaving] = useState(false);
    const [processingImage, setProcessingImage] = useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!categoryId && initialCategories[0]) setCategoryId(initialCategories[0].id);
    }, [initialCategories]);

    useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [objectUrl]);

    async function fileToBase64(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function triggerFilePicker() {
        fileInputRef.current?.click();
    }

    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] ?? null;
        if (!f) return;

        setProcessingImage(true);
        try {
            const dataUrl = await fileToBase64(f);

            if (objectUrl) URL.revokeObjectURL(objectUrl);

            const obj = URL.createObjectURL(f);
            setObjectUrl(obj);
            setPreviewUrl(obj);
            setImageBase64(dataUrl);
            setImageDeleted(false);
        } catch (err) {
            alert("Erro ao processar a imagem");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setProcessingImage(false);
        }
    }

    function handleDeleteImageStage() {
        if (!confirm("Remover a imagem deste item? (Apenas ao salvar)")) return;

        if (objectUrl) URL.revokeObjectURL(objectUrl);

        setPreviewUrl(null);
        setImageBase64(null);
        setImageDeleted(true);
    }

    function onPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value.replace(/,/g, "");
        if (/^\d*(\.\d{0,2})?$/.test(cleaned)) setPrice(cleaned);
    }
    function onPriceBlur() {
        if (!price) return;
        const num = Number(price);
        if (!Number.isNaN(num)) setPrice(num.toFixed(2));
    }
    function parsePrice(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    async function handleSave() {
        if (!name.trim()) return alert("Nome obrigatório");
        if (!price) return alert("Preço inválido");
        if (!categoryId) return alert("Selecione categoria");

        const priceCents = parsePrice(price);
        if (priceCents === null) return alert("Preço inválido");

        setSaving(true);
        try {
            const res = await fetch("/api/menu/update-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId: item.id,
                    name,
                    description: description.trim() || null,
                    price_cents: priceCents,
                    category_id: categoryId,
                    is_available: isAvailable,
                    imageBase64,
                    imageDeleted,
                    originalImagePath,
                }),
            });

            const json = await res.json();
            if (!res.ok || json.error) {
                console.error(json);
                alert("Erro ao salvar item");
                return;
            }

            router.push(`/menu/${menuId}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white p-6 rounded-lg shadow border">

                {/* Hidden file input */}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />

                {/* IMAGE AREA - clickable preview */}
                <div className="flex flex-col items-center md:items-start mb-4">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={triggerFilePicker}
                        onKeyDown={(e) => { if (["Enter", " "].includes(e.key)) triggerFilePicker(); }}
                        className="w-40 h-40 md:w-32 md:h-32 rounded overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer"
                    >
                        {previewUrl ? (
                            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-sm text-gray-400">Clique para adicionar imagem</div>
                        )}
                    </div>

                    {/* Delete button */}
                    {previewUrl && (
                        <button
                            onClick={handleDeleteImageStage}
                            disabled={processingImage}
                            className="mt-2 text-sm text-red-600 underline"
                        >
                            Remover imagem
                        </button>
                    )}
                </div>

                {/* FIELDS */}
                <label className="block mb-2 font-semibold">Nome</label>
                <input className="w-full border rounded px-3 py-2 mb-4" value={name} onChange={(e) => setName(e.target.value)} />

                <div className="flex items-center justify-between mb-2">
                    <label className="block font-semibold">Categoria</label>
                    <button type="button" onClick={() => setShowNewCategory(true)} className="text-sm text-blue-600 hover:underline">
                        + Nova categoria
                    </button>
                </div>

                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded px-3 py-2 mb-4">
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2 mb-4" />

                <label className="block mb-2 font-semibold">Preço (R$)</label>
                <input className="w-40 border rounded px-3 py-2 mb-4" value={price} onChange={onPriceChange} onBlur={onPriceBlur} />

                <label className="block mb-2 font-semibold">Disponibilidade</label>
                <label className="inline-flex items-center gap-2 mb-4">
                    <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
                    <span>{isAvailable ? "Disponível" : "Indisponível"}</span>
                </label>

                <div className="mt-6 flex gap-3">
                    <button onClick={handleSave} disabled={saving || processingImage} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                        {saving ? "Salvando..." : "Salvar"}
                    </button>

                    <button onClick={() => router.push(`/menu/${menuId}`)} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded">
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
                            <button onClick={() => setShowNewCategory(false)} className="px-3 py-1 rounded border">Cancelar</button>
                            <button onClick={async () => {
                                setCreatingCategory(true);
                                const trimmed = newCategoryName.trim();
                                if (!trimmed) return alert("Nome inválido");
                                const { data } = await supabase.from("categories")
                                    .insert([{ restaurant_id: restaurantId, name: trimmed }])
                                    .select("id, name").single();
                                if (data) {
                                    setCategories((prev) => [...prev, data]);
                                    setCategoryId(data.id);
                                }
                                setShowNewCategory(false);
                                setCreatingCategory(false);
                                setNewCategoryName("");
                            }} className="px-3 py-1 rounded bg-blue-600 text-white">
                                {creatingCategory ? "Criando..." : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

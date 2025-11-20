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
type Subitem = {
    id: string;
    item_subcategory_id: string;
    name: string;
    description?: string | null;
    price_cents: number;
    is_available: boolean;
    position: number;
    // image preview not in schema: optional
    image_path?: string | null;
};
type Subcategory = {
    id: string;
    item_id?: string;
    name: string;
    description?: string | null;
    min_select: number;
    max_select: number;
    position?: number;
    subitems?: Subitem[];
};

type Props = {
    menuId: string;
    restaurantId: string;
    item: ItemShape;
    categories: Category[];
    // new prop: subcategories already fetched on server
    subcategories?: Subcategory[];
};

export default function EditItemForm({
    menuId,
    restaurantId,
    item,
    categories: initialCategories,
    subcategories: initialSubcategories = [],
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

    // local state for subcategories so UI updates after delete
    const [subcategories, setSubcategories] = useState<Subcategory[]>(initialSubcategories);

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

            router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
        } finally {
            setSaving(false);
        }
    }

    // delete subcategory + its subitems
    async function handleDeleteSubcategory(subcatId: string) {
        if (!confirm("Excluir esta subcategoria e todos os subitens? Esta ação não pode ser desfeita.")) return;
        try {
            // first delete subitems
            const { error: delSubitemsErr } = await supabase
                .from("subitems")
                .delete()
                .eq("item_subcategory_id", subcatId);

            if (delSubitemsErr) {
                console.error("Erro ao deletar subitens:", delSubitemsErr);
                alert("Erro ao deletar subitens. Veja console.");
                return;
            }

            // then delete the subcategory
            const { error: delSubcatErr } = await supabase
                .from("item_subcategories")
                .delete()
                .eq("id", subcatId);

            if (delSubcatErr) {
                console.error("Erro ao deletar subcategoria:", delSubcatErr);
                alert("Erro ao deletar subcategoria. Veja console.");
                return;
            }

            // remove locally
            setSubcategories((prev) => prev.filter(s => s.id !== subcatId));
            alert("Subcategoria removida.");
        } catch (err) {
            console.error("Erro ao excluir subcategoria:", err);
            alert("Erro inesperado ao excluir subcategoria. Veja console.");
        }
    }

    return (
        <div className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
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

                        <button onClick={() => router.push(`/painel/${restaurantId}/cardapio/${menuId}`)} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded">
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

            {/* Right column: subcategories + subitems cards */}
            <aside className="space-y-4 h-[calc(100vh-6rem)] overflow-auto">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Subcategorias</h3>
                    <button
                        onClick={() => router.push(`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}/add-subcategory`)}
                        className="text-sm text-blue-600"
                    >
                        + Nova subcategoria
                    </button>
                </div>

                {subcategories.length === 0 ? (
                    <div className="text-sm text-gray-500">Nenhuma subcategoria criada para este item.</div>
                ) : (
                    subcategories.map((sc) => (
                        // make the whole card clickable to open subcategory page
                        <div
                            key={sc.id}
                            className="bg-white p-4 rounded shadow border flex flex-col justify-between hover:shadow-md cursor-pointer"
                            onClick={() => router.push(`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}/subcategory/${sc.id}`)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold">{sc.name}</h4>
                                    {sc.description && <p className="text-sm text-gray-600">{sc.description}</p>}
                                    <p className="text-xs text-gray-500 mt-1">min {sc.min_select} • max {sc.max_select}</p>
                                </div>

                                {/* keep only delete button (not part of card click) */}
                                <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleDeleteSubcategory(sc.id)}
                                        className="px-2 py-1 text-sm rounded border text-red-600"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>

                            {/* preview dos subitems (pequenas thumbnails / placeholders) */}
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {(sc.subitems || []).slice(0, 6).map(si => (
                                    <div
                                        key={si.id}
                                        className="h-20 w-full bg-gray-50 rounded overflow-hidden border flex flex-col items-center justify-center text-xs text-gray-600 p-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}/subcategory/${sc.id}/edit-subitem/${si.id}`);
                                        }}
                                    >
                                        {si.image_path ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={si.image_path} alt={si.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="w-full text-center">
                                                <div className="font-medium truncate">{si.name}</div>
                                                <div className="text-xs text-gray-700 mt-1 font-semibold">R$ {(si.price_cents / 100).toFixed(2)}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {/* botão adicionar subitem */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); router.push(`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}/subcategory/${sc.id}/add-subitem`); }}
                                    className="h-20 flex items-center justify-center rounded border text-sm text-blue-600"
                                >
                                    + Subitem
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </aside>
        </div>
    );
}

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

    // --- initial / form state ---
    const [name, setName] = useState(item.name ?? "");
    const [description, setDescription] = useState(item.description ?? "");
    const [price, setPrice] = useState(((item.price_cents ?? 0) / 100).toFixed(2));
    const [categoryId, setCategoryId] = useState<string | undefined>(
        item.category_id ?? initialCategories[0]?.id
    );
    const [isAvailable, setIsAvailable] = useState<boolean>(!!item.is_available);

    // image staging state
    // previewUrl = shown on UI (starts with existing items.image_path)
    const [previewUrl, setPreviewUrl] = useState<string | null>(item.image_path ?? null);
    // imageBase64 = new image dataURL chosen by user (staged). null = no new image chosen
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    // imageDeleted = user chose to delete image (staged). true = delete on Save
    const [imageDeleted, setImageDeleted] = useState(false);
    // store original path to be able to reference it if needed
    const originalImagePath = item.image_path ?? null;

    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);

    const [saving, setSaving] = useState(false);
    const [processingImage, setProcessingImage] = useState(false);

    // Keep track of any objectURL to revoke it later
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        setCategories(initialCategories);
        if (!categoryId && initialCategories[0]) setCategoryId(initialCategories[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCategories]);

    useEffect(() => {
        // cleanup objectURL on unmount or when changed
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [objectUrl]);

    // helper: convert file -> dataURL
    async function fileToBase64(file: File) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // open file picker
    function triggerFilePicker() {
        fileInputRef.current?.click();
    }

    // stage new file selection (no DB calls here)
    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] ?? null;
        if (!f) return;

        setProcessingImage(true);
        try {
            const dataUrl = await fileToBase64(f);

            // revoke previous object URL if exists
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                setObjectUrl(null);
            }

            const obj = URL.createObjectURL(f);
            setObjectUrl(obj);
            setPreviewUrl(obj);
            setImageBase64(dataUrl);
            setImageDeleted(false); // cancel staged deletion if any
        } catch (err) {
            console.error("Erro ao processar arquivo:", err);
            alert("Erro ao processar o arquivo selecionado.");
        } finally {
            setProcessingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    // stage deletion (only local: no DB call)
    function handleDeleteImageStage() {
        if (!confirm("Remover a imagem deste item? (A ação será aplicada somente ao salvar)")) return;
        // revoke objectURL if we created one
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            setObjectUrl(null);
        }
        setImageBase64(null); // remove any staged new image
        setPreviewUrl(null);
        setImageDeleted(true);
    }

    // price helpers
    function onPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value.replace(/,/g, "");
        if (/^\d*(\.\d{0,2})?$/.test(cleaned)) setPrice(cleaned);
    }
    function onPriceBlur() {
        if (!price) return;
        const num = Number(price);
        if (!Number.isNaN(num)) setPrice(num.toFixed(2));
    }
    function priceIsValid(p: string) {
        return /^\d+(\.\d{2})$/.test(p);
    }

    async function handleCreateCategory() {
        const nameTrim = newCategoryName.trim();
        if (!nameTrim) return alert("Nome inválido");
        setCreatingCategory(true);
        try {
            const { data, error } = await supabase
                .from("categories")
                .insert([{ restaurant_id: restaurantId, name: nameTrim }])
                .select("id, name")
                .single();

            if (error) {
                console.error("Erro ao criar categoria:", error);
                alert("Erro ao criar categoria. Veja console.");
            } else if (data) {
                setCategories((prev) => [...prev, { id: data.id, name: data.name }]);
                setCategoryId(data.id);
                setShowNewCategory(false);
                setNewCategoryName("");
            }
        } catch (err) {
            console.error(err);
            alert("Erro inesperado ao criar categoria.");
        } finally {
            setCreatingCategory(false);
        }
    }

    function parsePriceToCents(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    // --- SAVE: apply staged changes in order ---
    async function handleSave() {
        if (!name.trim()) return alert("Nome obrigatório");
        if (!price || !priceIsValid(price)) return alert("Preço inválido");
        if (!categoryId) return alert("Selecione categoria");

        const priceCents = parsePriceToCents(price);
        if (priceCents === null) return alert("Preço inválido");

        setSaving(true);

        try {
            // Substitui operações diretas ao DB por chamada ao endpoint server-side
            const body = {
                itemId: item.id,
                name: name.trim(),
                description: description.trim() || null,
                price_cents: priceCents,
                category_id: categoryId,
                is_available: isAvailable,
                imageBase64: imageBase64, // se for null -> não vai inserir imagem
                imageDeleted: imageDeleted, // boolean
                originalImagePath: originalImagePath, // ajuda o server a tentar remover do storage
            };

            const resp = await fetch("/api/menu/update-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await resp.json();
            if (!resp.ok || json.error) {
                console.error("Erro ao salvar item (server):", json);
                alert("Erro ao salvar item. Veja console.");
                setSaving(false);
                return;
            }

            alert("Item atualizado com sucesso.");
            router.push(`/menu/${menuId}`);
        } catch (err) {
            console.error("Erro inesperado ao salvar:", err);
            alert("Erro inesperado. Veja console.");
        } finally {
            setSaving(false);
        }
    }


    function handleCancel() {
        // nothing was written to DB except on Save, so cancel just navigates away
        router.push(`/menu/${menuId}`);
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white p-6 rounded-lg shadow border">
                <label className="block mb-2 font-semibold">Nome</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-4"
                    placeholder="Ex: X-Burger Brendo"
                />

                <div className="flex items-center justify-between mb-2">
                    <label className="block font-semibold">Categoria</label>
                    <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        + Nova categoria
                    </button>
                </div>

                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-4"
                >
                    <option value="">-- selecione --</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea
                    value={description ?? ""}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border rounded px-3 py-2 mb-4"
                />

                <label className="block mb-2 font-semibold">Preço (R$)</label>
                <input
                    value={price}
                    onChange={onPriceChange}
                    onBlur={onPriceBlur}
                    inputMode="decimal"
                    placeholder="25.50"
                    className="w-40 border rounded px-3 py-2 mb-4"
                />

                <div className="mb-4">
                    <label className="block mb-2 font-semibold">Disponibilidade</label>
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isAvailable}
                            onChange={(e) => setIsAvailable(e.target.checked)}
                            className="form-checkbox"
                        />
                        <span>{isAvailable ? "Disponível" : "Indisponível"}</span>
                    </label>
                </div>

                <div className="mb-4">
                    <label className="block mb-2 font-semibold">Imagem</label>

                    <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />

                    <div className="flex items-start gap-4">
                        <div className="w-32 h-32 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="preview"
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={triggerFilePicker}
                                />
                            ) : (
                                <div className="text-sm text-gray-500">Sem imagem</div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <button type="button" onClick={triggerFilePicker} className="px-3 py-1 rounded border text-sm">
                                Trocar imagem
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteImageStage}
                                className="px-3 py-1 rounded border text-sm text-red-600"
                                disabled={processingImage}
                            >
                                Remover imagem
                            </button>
                            <div className="text-xs text-gray-500">
                                Ao trocar/remover a imagem, a alteração será aplicada somente quando você clicar em{" "}
                                <strong>Salvar</strong>.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || processingImage}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                        {saving ? "Salvando..." : "Salvar"}
                    </button>

                    <button onClick={handleCancel} disabled={saving} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded">
                        Cancelar
                    </button>
                </div>
            </div>

            {/* Modal de nova categoria */}
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
                            <button onClick={handleCreateCategory} className="px-3 py-1 rounded bg-blue-600 text-white" disabled={creatingCategory}>
                                {creatingCategory ? "Criando..." : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

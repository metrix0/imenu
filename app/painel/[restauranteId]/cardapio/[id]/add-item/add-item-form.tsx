"use client";

import React, { useEffect, useRef, useState } from "react";
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
    categories: initialCategories,
}: Props) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
    const [isAvailable, setIsAvailable] = useState(true);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    const [categories, setCategories] = useState(initialCategories);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [saving, setSaving] = useState(false);

    // novo estado p/ modal de adicionar complementos
    const [showAddComplementsModal, setShowAddComplementsModal] = useState(false);
    const [createdItemId, setCreatedItemId] = useState<string | null>(null);

    useEffect(() => {
        setCategories(initialCategories);
        if (!categoryId && initialCategories[0]) setCategoryId(initialCategories[0].id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCategories]);

    useEffect(() => {
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [objectUrl]);

    // helper: file -> dataURL
    function fileToBase64(file: File) {
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

    // file selection handler
    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0] ?? null;
        if (!f) {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                setObjectUrl(null);
            }
            setPreviewUrl(null);
            setImageBase64(null);
            return;
        }

        // revoke previous
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            setObjectUrl(null);
        }

        const obj = URL.createObjectURL(f);
        setObjectUrl(obj);
        setPreviewUrl(obj);

        try {
            const data = await fileToBase64(f);
            setImageBase64(data);
        } catch (err) {
            console.error("Error processing image:", err);
            alert("Erro ao processar imagem");
            setImageBase64(null);
        } finally {
            // clear input so same file can be picked again if needed
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
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
    function parsePriceToCents(v: string) {
        const num = Number(v);
        return isNaN(num) ? null : Math.round(num * 100);
    }

    // create category directly (like edit flow)
    async function handleCreateCategory() {
        const trimmed = newCategoryName.trim();
        if (!trimmed) return alert("Nome inválido");

        if (!restaurantId) {
            alert("Restaurant id is missing — cannot create category.");
            return;
        }

        setCreatingCategory(true);
        try {
            const { data, error } = await supabase
                .from("categories")
                .insert([{ restaurant_id: restaurantId, name: trimmed }])
                .select("id, name")
                .single();

            if (error || !data) {
                console.error("Erro ao criar categoria:", JSON.stringify(error ?? data, null, 2));
                alert("Erro ao criar categoria. Veja console.");
                return;
            }

            setCategories((prev) => [...prev, { id: data.id, name: data.name }]);
            setCategoryId(data.id);
            setNewCategoryName("");
            setShowNewCategory(false);
        } catch (err) {
            console.error("Unexpected error creating category:", err);
            alert("Erro inesperado ao criar categoria. Veja console.");
        } finally {
            setCreatingCategory(false);
        }
    }

    // === handleSave: cria item e abre modal de complementar ===
    async function handleSave() {
        if (!name.trim()) return alert("Nome obrigatório");
        if (!price) return alert("Preço inválido");

        const cents = parsePriceToCents(price);
        if (!cents) return alert("Preço inválido");
        if (!categoryId) return alert("Selecione uma categoria");

        setSaving(true);

        try {
            const res = await fetch("/api/menu/insert-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    menuId,
                    restaurantId,
                    categoryId,
                    name,
                    description,
                    price_cents: cents,
                    is_available: isAvailable,
                    imageBase64,
                }),
            });

            const json = await res.json();

            if (!res.ok || json?.error) {
                console.error("Erro ao salvar item:", json);
                alert("Erro ao salvar item. Veja console.");
                setSaving(false);
                return;
            }

            // tenta extrair o id do item criado
            const createdId =
                json?.id ??
                json?.data?.id ??
                json?.itemId ??
                json?.insertedId ??
                json?.data?.item?.id ??
                (Array.isArray(json) && json[0]?.id) ??
                null;

            // se não há id, apenas volta ao menu (não podemos abrir add-subcategory sem id)
            if (!createdId) {
                console.warn("Não foi possível obter item id da resposta do servidor. Voltando ao menu.");
                router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
                return;
            }

            // salva o id e abre o modal (não navegamos ainda)
            setCreatedItemId(String(createdId));
            setShowAddComplementsModal(true);
        } catch (err) {
            console.error("Erro ao salvar item:", err);
            alert("Erro ao salvar item");
        } finally {
            setSaving(false);
        }
    }

    // ações do modal
    function handleAddComplementsNow() {
        if (!createdItemId) {
            router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
            return;
        }
        setShowAddComplementsModal(false);
        router.push(`/painel/${restaurantId}/cardapio/${menuId}/item/${createdItemId}/add-subcategory`);
    }

    function handleSkipComplements() {
        setShowAddComplementsModal(false);
        router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
    }

    return (
        <div className="max-w-3xl">
            <div className="bg-white p-6 rounded-lg shadow border">
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                    className="hidden"
                />

                {/* IMAGE TOP - clickable area */}
                <div className="flex flex-col items-center md:items-start mb-4">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={triggerFilePicker}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") triggerFilePicker(); }}
                        className="w-40 h-40 md:w-32 md:h-32 rounded overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer"
                        aria-label="Choose image"
                    >
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="preview"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-sm text-gray-400">Click to add image</div>
                        )}
                    </div>
                </div>

                {/* FORM FIELDS */}
                <label className="block mb-2 font-semibold">Nome</label>
                <input
                    className="w-full border rounded px-3 py-2 mb-4"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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

                {/* Disponibilidade */}
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

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                        {saving ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                        onClick={() => router.push(`/painel/${restaurantId}/cardapio/${menuId}`)}
                        className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            {/* Modal Nova Categoria */}
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

            {/* Modal: Adicionar complementos? */}
            {showAddComplementsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Adicionar complementos?</h3>
                        <p className="mb-4">
                            Deseja adicionar subcategorias / subitens (complementos) para este item agora?
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    // voltar ao menu sem adicionar complementos
                                    handleSkipComplements();
                                }}
                                className="px-3 py-1 rounded border"
                            >
                                Não
                            </button>

                            <button
                                onClick={() => {
                                    handleAddComplementsNow();
                                }}
                                className="px-3 py-1 rounded bg-blue-600 text-white"
                            >
                                Sim
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

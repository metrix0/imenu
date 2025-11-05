// app/menu/[id]/menu-admin-client.tsx
"use client";

import React, { useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation"; // added

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Category = {
    id: string;
    name: string;
};

type Item = {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_path: string | null;
    is_available: boolean;
    position: number;
    category?: Category | null;
};
type Subitem = {
    id: string;
    item_subcategory_id: string;
    name: string;
    description?: string | null;
    price_cents: number;
    is_available: boolean;
    position: number;
};
type SubcategoryLocal = {
    id: string;
    name: string;
    description?: string | null;
    min_select?: number;
    max_select?: number;
    position?: number;
    subitems: Subitem[];
};

export default function MenuAdminClient({
    menuId,
    menuName,
    items: initialItems,
    categories: initialCategories,
    restaurantId,
}: {
    menuId: string;
    menuName: string;
    items: Item[];
    categories: Category[];
    restaurantId: string;
}) {
    const router = useRouter(); // added
    const [items, setItems] = useState<Item[]>(initialItems);
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [isPending, startTransition] = useTransition();
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
    const [showCreateCategory, setShowCreateCategory] = useState(false);
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    const [showEditCategory, setShowEditCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");
    const [editingCategoryLoading, setEditingCategoryLoading] = useState(false);

    // New: expanded state and cached subcategories per item
    const [expandedSet, setExpandedSet] = useState<Record<string, boolean>>({});
    const [itemSubcats, setItemSubcats] = useState<Record<string, SubcategoryLocal[]>>({});
    const [subitemLoadingIds, setSubitemLoadingIds] = useState<Record<string, boolean>>({});

    // Toggle availability (updates items.is_available)
    async function toggleAvailability(itemId: string, current: boolean) {
        setLoadingIds((s) => ({ ...s, [itemId]: true }));
        const { error } = await supabase
            .from("items")
            .update({ is_available: !current })
            .eq("id", itemId);

        if (error) {
            console.error("Erro ao alterar disponibilidade", JSON.stringify(error, null, 2));
            alert("Erro ao alterar disponibilidade.");
        } else {
            setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, is_available: !current } : it))
            );
        }
        setLoadingIds((s) => ({ ...s, [itemId]: false }));
    }

    // delete single item via API. Returns true if deleted.
    async function deleteItemCompletely(itemId: string) {
        if (!confirm("Tem certeza? Este item será apagado DEFINITIVAMENTE do banco e do storage.")) return false;

        setLoadingIds((s) => ({ ...s, [itemId]: true }));

        try {
            const resp = await fetch("/api/menu/delete-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemId }),
            });

            const json = await resp.json();
            if (!resp.ok || json.error) {
                console.error("Erro ao excluir item:", JSON.stringify(json, null, 2));
                alert("Erro ao excluir item. Veja console.");
                return false;
            }

            // remove from local state
            setItems((prev) => prev.filter((it) => it.id !== itemId));
            return true;
        } catch (err) {
            console.error("Erro inesperado ao deletar item:", err);
            alert("Erro inesperado ao deletar item.");
            return false;
        } finally {
            setLoadingIds((s) => ({ ...s, [itemId]: false }));
        }
    }

    // Create a new category (direct supabase, now using restaurantId)
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
                // improved logging: stringify error to get details
                console.error("Erro ao criar categoria:", JSON.stringify(error ?? data, null, 2));
                alert("Erro ao criar categoria. Veja console.");
                return;
            }

            setCategories((prev) => [...prev, { id: data.id, name: data.name }]);
            setNewCategoryName("");
            setShowCreateCategory(false);
        } catch (err) {
            console.error("Unexpected error creating category:", err);
            alert("Erro inesperado ao criar categoria. Veja console.");
        } finally {
            setCreatingCategory(false);
        }
    }

    // Open edit modal
    function openEditCategory(cat: Category) {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name);
        setShowEditCategory(true);
    }

    // Save edited category name
    async function handleEditCategorySave() {
        if (!editingCategoryId) return;
        const trimmed = editingCategoryName.trim();
        if (!trimmed) return alert("Nome inválido");

        setEditingCategoryLoading(true);
        try {
            const { error } = await supabase
                .from("categories")
                .update({ name: trimmed })
                .eq("id", editingCategoryId);

            if (error) {
                console.error("Erro ao editar categoria:", JSON.stringify(error, null, 2));
                alert("Erro ao editar categoria. Veja console.");
                return;
            }

            setCategories((prev) => prev.map((c) => (c.id === editingCategoryId ? { ...c, name: trimmed } : c)));
            setShowEditCategory(false);
            setEditingCategoryId(null);
            setEditingCategoryName("");
        } finally {
            setEditingCategoryLoading(false);
        }
    }

    async function handleDeleteCategory(categoryId: string) {
        if (!confirm("Delete category and all items inside? This cannot be undone.")) return;

        setLoadingIds(s => ({ ...s, [categoryId]: true }));
        try {
            const resp = await fetch("/api/menu/delete-category", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoryId }),
            });
            const json = await resp.json();

            if (!resp.ok || json.error) {
                console.error("Erro ao deletar categoria:", JSON.stringify(json, null, 2));
                alert(`Erro ao deletar categoria: ${json?.error ?? "unknown"}`);
                return;
            }

            // remove categoria localmente
            setCategories(prev => prev.filter(c => c.id !== categoryId));
            // remove items belonging to that category locally as well
            setItems(prev => prev.filter(it => it.category?.id !== categoryId));

            alert("Categoria removida com sucesso.");
        } catch (err) {
            console.error("Unexpected error deleting category:", err);
            alert("Erro inesperado ao deletar categoria. Veja console.");
        } finally {
            setLoadingIds(s => ({ ...s, [categoryId]: false }));
        }
    }

    // Toggle expansion: if not loaded, fetch subcats+subitems
    async function toggleExpandItem(itemId: string) {
        setExpandedSet(s => ({ ...s, [itemId]: !s[itemId] }));
        if (itemSubcats[itemId]) return; // already loaded

        try {
            const { data: subcatsRaw, error: scErr } = await supabase
                .from("item_subcategories")
                .select("id, name, description, min_select, max_select, position")
                .eq("item_id", itemId)
                .order("position", { ascending: true });

            if (scErr) {
                console.error("Erro ao buscar subcategorias:", scErr);
                setItemSubcats(prev => ({ ...prev, [itemId]: [] }));
                return;
            }
            const subcats = subcatsRaw ?? [];

            const subcatIds = (subcats || []).map((s: any) => s.id);
            let subitems: Subitem[] = [];
            if (subcatIds.length > 0) {
                const { data: subsRaw, error: subsErr } = await supabase
                    .from("subitems")
                    .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
                    .in("item_subcategory_id", subcatIds)
                    .order("position", { ascending: true });

                if (subsErr) {
                    console.error("Erro ao buscar subitens:", subsErr);
                } else {
                    subitems = subsRaw ?? [];
                }
            }

            const organized: SubcategoryLocal[] = (subcats || []).map((sc: any) => ({
                id: sc.id,
                name: sc.name,
                description: sc.description,
                min_select: sc.min_select,
                max_select: sc.max_select,
                position: sc.position,
                subitems: (subitems || []).filter(si => si.item_subcategory_id === sc.id),
            }));

            setItemSubcats(prev => ({ ...prev, [itemId]: organized }));
        } catch (err) {
            console.error("Erro ao carregar expansão:", err);
            setItemSubcats(prev => ({ ...prev, [itemId]: [] }));
        }
    }

    // Toggle availability for a subitem
    async function toggleSubitemAvailability(itemId: string, siId: string, current: boolean) {
        setSubitemLoadingIds(s => ({ ...s, [siId]: true }));
        try {
            const { error } = await supabase
                .from("subitems")
                .update({ is_available: !current })
                .eq("id", siId);

            if (error) {
                console.error("Erro ao alternar disponibilidade do subitem:", error);
                alert("Erro ao alterar disponibilidade. Veja console.");
                return;
            }

            setItemSubcats(prev => {
                const copy = { ...prev };
                const arr = copy[itemId]?.map(sc => ({
                    ...sc,
                    subitems: sc.subitems.map(si => si.id === siId ? { ...si, is_available: !current } : si)
                })) ?? [];
                copy[itemId] = arr;
                return copy;
            });
        } finally {
            setSubitemLoadingIds(s => ({ ...s, [siId]: false }));
        }
    }

    // Delete subitem but keep historical references: set order_item_subitems.subitem_id = null then delete subitem
    async function deleteSubitem(itemId: string, siId: string) {
        if (!confirm("Excluir este subitem? O histórico de pedidos manterá os dados (subitem_id ficará NULL).")) return;
        setSubitemLoadingIds(s => ({ ...s, [siId]: true }));
        try {
            const { error: updErr } = await supabase
                .from("order_item_subitems")
                .update({ subitem_id: null })
                .eq("subitem_id", siId);

            if (updErr) {
                console.error("Erro ao atualizar histórico de pedidos:", updErr);
                alert("Erro ao atualizar histórico. Veja console.");
                return;
            }

            const { error: delErr } = await supabase
                .from("subitems")
                .delete()
                .eq("id", siId);

            if (delErr) {
                console.error("Erro ao deletar subitem:", delErr);
                alert("Erro ao deletar subitem. Veja console.");
                return;
            }

            // remove locally
            setItemSubcats(prev => {
                const copy = { ...prev };
                if (!copy[itemId]) return copy;
                copy[itemId] = copy[itemId].map(sc => ({
                    ...sc,
                    subitems: sc.subitems.filter(si => si.id !== siId)
                }));
                return copy;
            });

            alert("Subitem excluído.");
        } catch (err) {
            console.error("Erro ao excluir subitem:", err);
            alert("Erro inesperado. Veja console.");
        } finally {
            setSubitemLoadingIds(s => ({ ...s, [siId]: false }));
        }
    }

    // Build items per category quickly
    const itemsByCategory = categories.reduce<Record<string, Item[]>>((acc, cat) => {
        acc[cat.id] = [];
        return acc;
    }, {});

    // put items into their category arrays; if item has no category, put under '_uncategorized'
    const uncategorizedKey = "_uncategorized";
    if (!itemsByCategory[uncategorizedKey]) itemsByCategory[uncategorizedKey] = [];

    items.forEach((it) => {
        const catId = it.category?.id ?? null;
        if (catId && itemsByCategory[catId]) {
            itemsByCategory[catId].push(it);
        } else {
            itemsByCategory[uncategorizedKey].push(it);
        }
    });

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Cardápio: {menuName}</h1>

                <div className="flex gap-3">
                    <Link
                        href={`/menu/${menuId}/add-item`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                        + Adicionar item
                    </Link>

                    <button
                        onClick={() => setShowCreateCategory(true)}
                        className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded"
                    >
                        + Adicionar categoria
                    </button>
                </div>
            </div>

            {/* If no categories at all, show message + allow create */}
            {categories.length === 0 && (
                <div className="mb-6">
                    <div className="text-gray-600">No categories yet. Create one to start grouping items.</div>
                </div>
            )}

            <div className="space-y-8">
                {/* Render each category as a section */}
                {categories.map((cat) => (
                    <section key={cat.id}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">{cat.name}</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditCategory(cat)}
                                    className="px-3 py-1 rounded border text-sm"
                                >
                                    Editar categoria
                                </button>
                                <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="px-3 py-1 rounded border text-sm text-red-600"
                                >
                                    Excluir categoria e itens
                                </button>
                            </div>
                        </div>

                        {/* items for this category */}
                        <div className="grid grid-cols-1 gap-4">
                            {(itemsByCategory[cat.id] || []).map((item) => (
                                <div key={item.id} className="flex flex-col gap-2">
                                    <a
                                        href={`/menu/${menuId}/item/${item.id}`}
                                        className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow border cursor-pointer no-underline"
                                    >
                                        <div className="flex-shrink-0">
                                            {item.image_path ? (
                                                <img
                                                    src={item.image_path}
                                                    alt={item.name}
                                                    className="w-24 h-24 object-cover rounded-lg"
                                                    style={{ minWidth: 96, minHeight: 96 }}
                                                />
                                            ) : (
                                                <div
                                                    className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"
                                                    style={{ minWidth: 96, minHeight: 96 }}
                                                >
                                                    Sem imagem
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div className="truncate">
                                                    <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                                                    <p className="mt-2 text-sm text-gray-700">{item.description}</p>
                                                    <p className="mt-2 font-semibold">R$ {(item.price_cents / 100).toFixed(2)}</p>
                                                </div>

                                                {/* actions - desktop */}
                                                <div className="hidden md:flex md:flex-col md:items-end md:gap-2 ml-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            startTransition(() => toggleAvailability(item.id, item.is_available));
                                                        }}
                                                        className={`px-3 py-1 rounded ${item.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                                        disabled={!!loadingIds[item.id]}
                                                    >
                                                        {loadingIds[item.id] ? "..." : item.is_available ? "Disponível" : "Indisponível"}
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            startTransition(() => { void deleteItemCompletely(item.id); });
                                                        }}
                                                        className="px-3 py-1 rounded border text-sm text-red-600"
                                                        disabled={!!loadingIds[item.id]}
                                                    >
                                                        {loadingIds[item.id] ? "..." : "Excluir"}
                                                    </button>

                                                    {/* Expand button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            void toggleExpandItem(item.id);
                                                        }}
                                                        className="px-3 py-1 rounded border text-sm"
                                                    >
                                                        {expandedSet[item.id] ? "Fechar" : "Expandir"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* actions - mobile */}
                                            <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        startTransition(() => toggleAvailability(item.id, item.is_available));
                                                    }}
                                                    className={`px-3 py-1 rounded ${item.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                                    disabled={!!loadingIds[item.id]}
                                                >
                                                    {loadingIds[item.id] ? "..." : item.is_available ? "Disponível" : "Indisponível"}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        startTransition(() => { void deleteItemCompletely(item.id); });
                                                    }}
                                                    className="px-3 py-1 rounded border text-sm text-red-600"
                                                    disabled={!!loadingIds[item.id]}
                                                >
                                                    {loadingIds[item.id] ? "..." : "Excluir"}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        void toggleExpandItem(item.id);
                                                    }}
                                                    className="px-3 py-1 rounded border text-sm"
                                                >
                                                    {expandedSet[item.id] ? "Fechar" : "Expandir"}
                                                </button>
                                            </div>
                                        </div>
                                    </a>

                                    {/* Expanded panel: subcategories and subitems for this item */}
                                    {expandedSet[item.id] && (
                                        <div className="bg-white rounded-lg shadow border p-4">
                                            <h4 className="font-semibold mb-3">Subcategorias / Subitens</h4>

                                            {(itemSubcats[item.id] && itemSubcats[item.id].length > 0) ? (
                                                <div className="space-y-3">
                                                    {itemSubcats[item.id].map((sc) => (
                                                        <div key={sc.id} className="border rounded p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div>
                                                                    <div className="font-medium">{sc.name}</div>
                                                                    {sc.description && <div className="text-sm text-gray-600">{sc.description}</div>}
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 space-y-2">
                                                                {sc.subitems.length === 0 ? (
                                                                    <div className="text-sm text-gray-500">Nenhum subitem</div>
                                                                ) : (
                                                                    sc.subitems.map((si) => (
                                                                        <div key={si.id} className="flex items-center justify-between rounded p-2 hover:bg-gray-50">
                                                                            <div className="min-w-0">
                                                                                <div className="font-medium truncate">{si.name}</div>
                                                                                {si.description && <div className="text-sm text-gray-600 truncate">{si.description}</div>}
                                                                                <div className="text-sm mt-1 font-semibold">R$ {(si.price_cents / 100).toFixed(2)}</div>
                                                                            </div>

                                                                            <div className="flex items-center gap-2 ml-4">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        void toggleSubitemAvailability(item.id, si.id, si.is_available);
                                                                                    }}
                                                                                    className={`px-3 py-1 rounded text-sm ${si.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                                                                    disabled={!!subitemLoadingIds[si.id]}
                                                                                >
                                                                                    {subitemLoadingIds[si.id] ? "..." : si.is_available ? "Disponível" : "Indisponível"}
                                                                                </button>

                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        void deleteSubitem(item.id, si.id);
                                                                                    }}
                                                                                    className="px-3 py-1 rounded border text-sm text-red-600"
                                                                                    disabled={!!subitemLoadingIds[si.id]}
                                                                                >
                                                                                    {subitemLoadingIds[si.id] ? "..." : "Excluir"}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500">Nenhuma subcategoria encontrada.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                {/* Optional: uncategorized group */}
                {itemsByCategory[uncategorizedKey] && itemsByCategory[uncategorizedKey].length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Uncategorized</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {itemsByCategory[uncategorizedKey].map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow border"
                                >
                                    <div className="flex-shrink-0">
                                        {item.image_path ? (
                                            <img
                                                src={item.image_path}
                                                alt={item.name}
                                                className="w-24 h-24 object-cover rounded-lg"
                                                style={{ minWidth: 96, minHeight: 96 }}
                                            />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400" style={{ minWidth: 96, minHeight: 96 }}>
                                                Sem imagem
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="truncate">
                                                <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                                                <p className="mt-2 text-sm text-gray-700">{item.description}</p>
                                                <p className="mt-2 font-semibold">R$ {(item.price_cents / 100).toFixed(2)}</p>
                                            </div>

                                            <div className="hidden md:flex md:flex-col md:items-end md:gap-2 ml-4">
                                                <button
                                                    onClick={() => startTransition(() => toggleAvailability(item.id, item.is_available))}
                                                    className={`px-3 py-1 rounded ${item.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                                    disabled={!!loadingIds[item.id]}
                                                >
                                                    {loadingIds[item.id] ? "..." : item.is_available ? "Disponível" : "Indisponível"}
                                                </button>

                                                <Link
                                                    href={`/menu/${menuId}/item/${item.id}`}
                                                    className="px-3 py-1 rounded border text-sm text-gray-700"
                                                >
                                                    Editar
                                                </Link>

                                                <button
                                                    onClick={() => startTransition(() => {
                                                        void deleteItemCompletely(item.id);
                                                    })}
                                                    className="px-3 py-1 rounded border text-sm text-red-600"
                                                    disabled={!!loadingIds[item.id]}
                                                >
                                                    {loadingIds[item.id] ? "..." : "Excluir"}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                            <button
                                                onClick={() => startTransition(() => toggleAvailability(item.id, item.is_available))}
                                                className={`px-3 py-1 rounded ${item.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                                disabled={!!loadingIds[item.id]}
                                            >
                                                {loadingIds[item.id] ? "..." : item.is_available ? "Disponível" : "Indisponível"}
                                            </button>

                                            <Link
                                                href={`/menu/${menuId}/item/${item.id}`}
                                                className="px-3 py-1 rounded border text-sm text-gray-700"
                                            >
                                                Editar
                                            </Link>

                                            <button
                                                onClick={() => startTransition(() => {
                                                    void deleteItemCompletely(item.id);
                                                })}
                                                className="px-3 py-1 rounded border text-sm text-red-600"
                                                disabled={!!loadingIds[item.id]}
                                            >
                                                {loadingIds[item.id] ? "..." : "Excluir"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Create Category Modal */}
            {showCreateCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Create new category</h3>
                        <input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="w-full border rounded px-3 py-2 mb-4"
                            placeholder="Category name"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateCategory(false);
                                    setNewCategoryName("");
                                }}
                                className="px-3 py-1 rounded border"
                                disabled={creatingCategory}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCategory}
                                className="px-3 py-1 rounded bg-blue-600 text-white"
                                disabled={creatingCategory}
                            >
                                {creatingCategory ? "Creating..." : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Category Modal */}
            {showEditCategory && editingCategoryId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Edit category</h3>
                        <input
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="w-full border rounded px-3 py-2 mb-4"
                            placeholder="Category name"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowEditCategory(false);
                                    setEditingCategoryId(null);
                                    setEditingCategoryName("");
                                }}
                                className="px-3 py-1 rounded border"
                                disabled={editingCategoryLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditCategorySave}
                                className="px-3 py-1 rounded bg-blue-600 text-white"
                                disabled={editingCategoryLoading}
                            >
                                {editingCategoryLoading ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

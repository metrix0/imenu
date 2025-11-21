// app/menu/[id]/menu-admin-client.tsx
"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation"; // added
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { icons } from "../../../../lib/fontawesome";
import { uploadBannerImage } from "../../../../lib/uploadBannerImage";
import { supabase as clientSupabase } from "../../../../lib/supabaseClient"; // optional direct client if needed

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
    restaurantId,
    menuId,
    menuName,
    items: initialItems,
    categories: initialCategories,
    restaurantOwnerId,
    restaurantLogoUrl,
    initialBannerUrl,
    initialDescription,
}: {
    restaurantId: string;
    menuId: string;
    menuName: string;
    items: Item[];
    categories: Category[];
    restaurantOwnerId?: string | null;
    restaurantLogoUrl?: string | null;
    initialBannerUrl?: string | null;
    initialDescription?: string | null;
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

    // banner state & file input ref
    const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl ?? null);
    const [bannerUploading, setBannerUploading] = useState(false);
    const bannerInputRef = useRef<HTMLInputElement | null>(null);

    // title/description inline editing
    const [editingTitle, setEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(menuName ?? "");
    const [editingDesc, setEditingDesc] = useState(false);
    // temp editor value
    const [tempDesc, setTempDesc] = useState<string>(initialDescription ?? "");
    // displayed description (updated after save)
    const [displayedDescription, setDisplayedDescription] = useState<string | null>(initialDescription ?? null);

    // Reorder state for categories
    const [showReorderCategories, setShowReorderCategories] = useState(false);
    const [categoriesOrder, setCategoriesOrder] = useState<Category[]>(initialCategories);
    const [draggingCatId, setDraggingCatId] = useState<string | null>(null);

    // Reorder state for items
    const [showReorderItemsForCategory, setShowReorderItemsForCategory] = useState<string | null>(null);
    const [itemsOrderForCategory, setItemsOrderForCategory] = useState<Item[]>([]);
    const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

    // keep categoriesOrder in sync when initialCategories changes (server updates)
    useEffect(() => {
        setCategoriesOrder(initialCategories);
    }, [initialCategories]);

    // DRAG HANDLERS (generic helpers)
    function onDragStartCategory(e: React.DragEvent, catId: string) {
        setDraggingCatId(catId);
        e.dataTransfer.effectAllowed = "move";
    }
    function onDragOverCategory(e: React.DragEvent) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }
    function onDropCategory(e: React.DragEvent, overCatId: string) {
        e.preventDefault();
        if (!draggingCatId || draggingCatId === overCatId) return;
        const fromIndex = categoriesOrder.findIndex(c => c.id === draggingCatId);
        const toIndex = categoriesOrder.findIndex(c => c.id === overCatId);
        if (fromIndex === -1 || toIndex === -1) return;
        const copy = [...categoriesOrder];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved);
        setCategoriesOrder(copy);
        setDraggingCatId(null);
    }

    async function saveCategoryOrder() {
        try {
            // persist positions (0-based -> you may prefer 1-based)
            await Promise.all(categoriesOrder.map((c, idx) =>
                supabase.from("categories").update({ position: idx }).eq("id", c.id)
            ));
            setCategories(categoriesOrder); // update local state for UI
            setShowReorderCategories(false);
            alert("Ordem das categorias salva.");
        } catch (err) {
            console.error("Erro ao salvar ordem das categorias:", err);
            alert("Erro ao salvar ordem das categorias. Veja console.");
        }
    }

    // Items reorder handlers
    function openReorderItemsModal(catId: string) {
        const arr = (itemsByCategory[catId] || []).slice(); // copy
        // sort by position just in case
        arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setItemsOrderForCategory(arr);
        setShowReorderItemsForCategory(catId);
    }

    function onDragStartItem(e: React.DragEvent, itemId: string) {
        setDraggingItemId(itemId);
        e.dataTransfer.effectAllowed = "move";
    }
    function onDragOverItem(e: React.DragEvent) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }
    function onDropItem(e: React.DragEvent, overItemId: string) {
        e.preventDefault();
        if (!draggingItemId || draggingItemId === overItemId) return;
        const fromIndex = itemsOrderForCategory.findIndex(it => it.id === draggingItemId);
        const toIndex = itemsOrderForCategory.findIndex(it => it.id === overItemId);
        if (fromIndex === -1 || toIndex === -1) return;
        const copy = [...itemsOrderForCategory];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved);
        setItemsOrderForCategory(copy);
        setDraggingItemId(null);
    }

    async function saveItemOrder() {
        if (!showReorderItemsForCategory) return;
        try {
            await Promise.all(itemsOrderForCategory.map((it, idx) =>
                supabase.from("items").update({ position: idx }).eq("id", it.id)
            ));
            // update local items state to reflect new positions
            setItems(prev => {
                const map = new Map(prev.map(p => [p.id, p]));
                itemsOrderForCategory.forEach((it, idx) => {
                    const existing = map.get(it.id);
                    if (existing) existing.position = idx;
                });
                return [...map.values()];
            });
            setShowReorderItemsForCategory(null);
            alert("Ordem dos itens salva.");
        } catch (err) {
            console.error("Erro ao salvar ordem dos itens:", err);
            alert("Erro ao salvar ordem dos itens. Veja console.");
        }
    }

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

    // Auth: bloquear acesso se não for o dono do restaurante
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/admin/login");
                return;
            }
            if (restaurantOwnerId && session.user.id !== restaurantOwnerId) {
                // não autorizado
                alert("Você não tem permissão para acessar este cardápio.");
                router.push("/admin/login");
                return;
            }
        })();
    }, [restaurantOwnerId, router]);

    // save title
    async function saveTitle() {
        const newTitle = tempTitle?.trim();
        if (!newTitle) return alert("Título não pode ficar vazio");
        const { error } = await supabase.from("menu").update({ name: newTitle }).eq("id", menuId);
        if (error) {
            console.error("Erro ao salvar título:", error);
            alert("Erro ao salvar título. Veja console.");
            return;
        }
        setEditingTitle(false);
        // ideal atualizar algum estado global / revalidar, aqui atualizamos local heading
    }

    // save description
    async function saveDescription() {
        const newDesc = (tempDesc ?? "").trim() || null;
        const { error } = await supabase.from("menu").update({ description: newDesc }).eq("id", menuId);
        if (error) {
            console.error("Erro ao salvar descrição:", error);
            alert("Erro ao salvar descrição. Veja console.");
            return;
        }
        setDisplayedDescription(newDesc);
        setEditingDesc(false);
    }

    const triggerBannerUpload = () => bannerInputRef.current?.click();
    const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerUploading(true);
        try {
            const key = await uploadBannerImage(file);
            const { error } = await supabase.from("menu").update({ banner_url: key }).eq("id", menuId);
            if (error) throw error;
            const publicUrl = supabase.storage.from("menu-banners").getPublicUrl(key).data?.publicUrl;
            setBannerUrl(publicUrl ?? null);
            alert("Banner atualizado.");
        } catch (err) {
            console.error("Erro no upload do banner:", err);
            alert("Erro ao enviar banner. Veja console.");
        } finally {
            setBannerUploading(false);
        }
    };

    const handleRemoveBanner = async () => {
        if (!confirm("Remover banner do cardápio?")) return;
        try {
            // obter chave atual do menu (server pode ter chave diferente); aqui assumimos que initialBannerUrl correlaciona ao key armazenado
            const { data: menuRow } = await supabase.from("menu").select("banner_url").eq("id", menuId).single();
            const key = menuRow?.banner_url;
            if (key) {
                await supabase.storage.from("menu-banners").remove([key]);
            }
            const { error } = await supabase.from("menu").update({ banner_url: null }).eq("id", menuId);
            if (error) {
                console.error("Erro ao remover banner:", error);
                alert("Erro ao remover banner. Veja console.");
                return;
            }
            setBannerUrl(null);
            alert("Banner removido.");
        } catch (err) {
            console.error("Erro ao remover banner:", err);
            alert("Erro ao remover banner. Veja console.");
        }
    };

    return (
        <div className="p-6">
            {/* Reorder categories modal toggle (next to add category button rendered later) */}
         {/* BANNER AREA (topo, full width responsivo) */}
         <div className="mb-6">
                <div className="w-full overflow-hidden" style={{ maxHeight: 420 }}>
                    <div
                        className="relative w-full h-56 sm:h-96 cursor-pointer"
                        onClick={triggerBannerUpload}
                        title="Clique para trocar o banner"
                    >
                        {bannerUrl ? (
                            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-600">
                                Clique para adicionar banner do cardápio
                            </div>
                        )}
                        <div className="absolute right-4 top-4 flex gap-2">
                            {bannerUrl && (
                                <button onClick={(e) => { e.stopPropagation(); handleRemoveBanner(); }} className="bg-black bg-opacity-40 text-white p-2 rounded">
                                    <FontAwesomeIcon icon={icons.faTrash} />
                                </button>
                            )}
                        </div>
                    </div>
                    <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerFile} className="hidden" />
                </div>

                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                        {restaurantLogoUrl && <img src={restaurantLogoUrl} alt="Logo" className="w-16 h-16 rounded-full object-cover" />}
                        <div>
                            {/* title editable */}
                            <div className="flex items-center gap-3">
                                {editingTitle ? (
                                    <>
                                        <input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} className="border px-2 py-1 rounded" />
                                        <button onClick={saveTitle} className="bg-indigo-600 text-white px-3 py-1 rounded">Salvar</button>
                                        <button onClick={() => { setEditingTitle(false); setTempTitle(menuName); }} className="px-3 py-1 rounded border">Cancelar</button>
                                    </>
                                ) : (
                                    <>
                                        <h1 className="text-2xl font-bold">Cardápio: {menuName}</h1>
                                        <button onClick={() => setEditingTitle(true)} className="text-sm text-gray-500">Editar</button>
                                    </>
                                )}
                            </div>

                            {/* description editable */}
                            <div className="mt-2">
                                {editingDesc ? (
                                    <div>
                                        <textarea value={tempDesc ?? ""} onChange={(e) => setTempDesc(e.target.value)} className="w-full border rounded p-2" rows={3} />
                                        <div className="mt-2 flex gap-2">
                                            <button onClick={saveDescription} className="bg-indigo-600 text-white px-3 py-1 rounded">Salvar</button>
                                            <button onClick={() => { setEditingDesc(false); setTempDesc(displayedDescription ?? ""); }} className="px-3 py-1 rounded border">Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-gray-700">{displayedDescription ?? <span className="italic text-gray-400">Sem descrição</span>}</p>
                                        <button onClick={() => setEditingDesc(true)} className="text-sm text-gray-500 mt-1">Editar descrição</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href={`/painel/${restaurantId}/cardapio/${menuId}/add-item`}
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

                        <button
                            onClick={() => setShowReorderCategories(true)}
                            className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded border text-sm flex items-center gap-2"
                            title="Reordenar categorias"
                        >
                            <FontAwesomeIcon icon={icons.faGripLines} /> Reordenar categorias
                        </button>
                    </div>
                </div>
            </div>

            {/* Reorder Categories Modal */}
            {showReorderCategories && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Reordenar categorias</h3>
                        <div className="space-y-2">
                            {categoriesOrder.map((cat) => (
                                <div
                                    key={cat.id}
                                    draggable
                                    onDragStart={(e) => onDragStartCategory(e, cat.id)}
                                    onDragOver={onDragOverCategory}
                                    onDrop={(e) => onDropCategory(e, cat.id)}
                                    className="flex items-center gap-3 p-2 border rounded bg-gray-50"
                                >
                                    <div className="text-gray-500 cursor-move"><FontAwesomeIcon icon={icons.faGripLines} /></div>
                                    <div className="flex-1">{cat.name}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button onClick={() => setShowReorderCategories(false)} className="px-3 py-1 rounded border">Cancelar</button>
                            <button onClick={saveCategoryOrder} className="px-3 py-1 rounded bg-indigo-600 text-white">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reorder Items Modal */}
            {showReorderItemsForCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Reordenar itens</h3>
                        <div className="space-y-2">
                            {itemsOrderForCategory.map((it) => (
                                <div
                                    key={it.id}
                                    draggable
                                    onDragStart={(e) => onDragStartItem(e, it.id)}
                                    onDragOver={onDragOverItem}
                                    onDrop={(e) => onDropItem(e, it.id)}
                                    className="flex items-center gap-3 p-2 border rounded bg-gray-50"
                                >
                                    <div className="text-gray-500 cursor-move"><FontAwesomeIcon icon={icons.faGripLines} /></div>
                                    <div className="flex-1">{it.name}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button onClick={() => setShowReorderItemsForCategory(null)} className="px-3 py-1 rounded border">Cancelar</button>
                            <button onClick={saveItemOrder} className="px-3 py-1 rounded bg-indigo-600 text-white">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

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
                                <button
                                    onClick={() => openReorderItemsModal(cat.id)}
                                    className="px-3 py-1 rounded border text-sm"
                                    title="Alterar ordens dos itens"
                                >
                                    <FontAwesomeIcon icon={icons.faGripLines} /> Alterar ordens dos itens
                                </button>
                            </div>
                        </div>

                        {/* items for this category */}
                        <div className="grid grid-cols-1 gap-4">
                            {(itemsByCategory[cat.id] || []).map((item) => (
                                <div key={item.id} className="flex flex-col gap-2">
                                    <a
                                        href={`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}`}
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
                                                    href={`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}`}
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
                                                href={`/painel/${restaurantId}/cardapio/${menuId}/item/${item.id}`}
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

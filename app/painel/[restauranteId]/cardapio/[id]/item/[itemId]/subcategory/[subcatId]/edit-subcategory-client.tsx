"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export default function EditSubcategoryClient({
    restauranteId,
    menuId,
    itemId,
    subcategory,
    subitems,
}: {
    restauranteId: string;
    menuId: string;
    itemId: string;
    subcategory: any;
    subitems: any[];
}) {
    const router = useRouter();
    const [name, setName] = useState(subcategory.name ?? "");
    const [description, setDescription] = useState(subcategory.description ?? "");
    const [minSelect, setMinSelect] = useState<number>(subcategory.min_select ?? 0);
    const [maxSelect, setMaxSelect] = useState<number>(subcategory.max_select ?? 1);
    const [saving, setSaving] = useState(false);

    const [localSubitems, setLocalSubitems] = useState<any[]>(subitems ?? []);

    async function handleSave(e?: React.FormEvent) {
        e?.preventDefault();
        if (!name.trim()) return alert("Nome obrigatório");
        if (minSelect < 0 || maxSelect < 0 || maxSelect < minSelect) return alert("Validação inválida");

        setSaving(true);
        try {
            const { error } = await supabase
                .from("item_subcategories")
                .update({ name: name.trim(), description: description.trim() || null, min_select: minSelect, max_select: maxSelect })
                .eq("id", subcategory.id);

            if (error) {
                console.error("Erro ao salvar subcategoria:", error);
                alert("Erro ao salvar subcategoria. Veja console.");
                return;
            }

            router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}`);
        } finally {
            setSaving(false);
        }
    }

    function goAddSubitem() {
        router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}/subcategory/${subcategory.id}/add-subitem`);
    }

    // toggle availability for a subitem
    async function toggleSubitemAvailability(siId: string, current: boolean) {
        try {
            const { error } = await supabase
                .from("subitems")
                .update({ is_available: !current })
                .eq("id", siId);

            if (error) {
                console.error("Erro ao alternar disponibilidade:", error);
                alert("Erro ao alternar disponibilidade. Veja console.");
                return;
            }
            setLocalSubitems(prev => prev.map(s => s.id === siId ? { ...s, is_available: !current } : s));
        } catch (err) {
            console.error("Erro inesperado:", err);
            alert("Erro inesperado. Veja console.");
        }
    }

    // delete subitem but keep historical records: set order_item_subitems.subitem_id = null then delete subitem
    async function deleteSubitem(siId: string) {
        if (!confirm("Excluir este subitem? Isso removerá o subitem mas manterá o histórico do pedido (o registro ficará com subitem_id = null).")) return;
        try {
            // dissociate from historical order rows
            const { error: updErr } = await supabase
                .from("order_item_subitems")
                .update({ subitem_id: null })
                .eq("subitem_id", siId);

            if (updErr) {
                console.error("Erro ao atualizar histórico de pedidos:", updErr);
                alert("Erro ao atualizar histórico. Veja console.");
                return;
            }

            // delete subitem
            const { error: delErr } = await supabase
                .from("subitems")
                .delete()
                .eq("id", siId);

            if (delErr) {
                console.error("Erro ao deletar subitem:", delErr);
                alert("Erro ao deletar subitem. Veja console.");
                return;
            }

            setLocalSubitems(prev => prev.filter(s => s.id !== siId));
            alert("Subitem excluído.");
        } catch (err) {
            console.error("Erro ao excluir subitem:", err);
            alert("Erro inesperado. Veja console.");
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Editar subcategoria — {subcategory.name}</h1>

            <form onSubmit={handleSave} className="bg-white p-6 rounded shadow border max-w-2xl mb-6">
                <label className="block mb-2 font-semibold">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" />

                <label className="block mb-2 font-semibold">Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" />

                <div className="flex gap-3 mb-3">
                    <div>
                        <label className="block text-sm">Min</label>
                        <input type="number" min={0} value={minSelect} onChange={(e) => setMinSelect(Number(e.target.value))} className="border rounded px-2 py-1 w-20" />
                    </div>
                    <div>
                        <label className="block text-sm">Max</label>
                        <input type="number" min={0} value={maxSelect} onChange={(e) => setMaxSelect(Number(e.target.value))} className="border rounded px-2 py-1 w-20" />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">{saving ? "Salvando..." : "Salvar"}</button>
                    <button type="button" onClick={() => router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}`)} className="px-3 py-2 rounded border">Voltar</button>
                    <button type="button" onClick={goAddSubitem} className="px-3 py-2 rounded bg-blue-600 text-white">Adicionar subitem</button>
                </div>
            </form>

            <div className="bg-white p-6 rounded shadow border">
                <h2 className="text-lg font-semibold mb-3">Subitens</h2>
                {localSubitems.length === 0 ? (
                    <div className="text-sm text-gray-500">Nenhum subitem.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {localSubitems.map(si => (
                            <div
                                key={si.id}
                                className="p-3 border rounded flex items-center justify-between cursor-pointer hover:shadow-sm"
                                onClick={() => router.push(`/painel/${restauranteId}/cardapio/${menuId}/item/${itemId}/subcategory/${subcategory.id}/edit-subitem/${si.id}`)}
                            >
                                <div>
                                    <div className="font-medium">{si.name}</div>
                                    {si.description && <div className="text-sm text-gray-600">{si.description}</div>}
                                    <div className="mt-1 text-sm font-semibold">R$ {(si.price_cents / 100).toFixed(2)}</div>
                                </div>

                                <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleSubitemAvailability(si.id, si.is_available)}
                                        className={`px-3 py-1 rounded text-sm ${si.is_available ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"}`}
                                    >
                                        {si.is_available ? "Disponível" : "Indisponível"}
                                    </button>

                                    <button
                                        onClick={() => deleteSubitem(si.id)}
                                        className="px-3 py-1 rounded border text-sm text-red-600"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

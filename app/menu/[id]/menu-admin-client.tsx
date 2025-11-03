// app/menu/[id]/MenuAdminClient.tsx
"use client";

import React, { useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

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

export default function MenuAdminClient({
    menuId,
    menuName,
    items: initialItems,
}: {
    menuId: string;
    menuName: string;
    items: Item[];
}) {
    const [items, setItems] = useState<Item[]>(initialItems);
    const [isPending, startTransition] = useTransition();
    const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

    // Toggle availability (updates items.is_available)
    async function toggleAvailability(itemId: string, current: boolean) {
        setLoadingIds((s) => ({ ...s, [itemId]: true }));
        const { error } = await supabase
            .from("items")
            .update({ is_available: !current })
            .eq("id", itemId);

        if (error) {
            console.error("Erro ao alterar disponibilidade", error);
            alert("Erro ao alterar disponibilidade.");
        } else {
            setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, is_available: !current } : it))
            );
        }
        setLoadingIds((s) => ({ ...s, [itemId]: false }));
    }

    // Remove APENAS a associação item <-> menu (menu_items)
    async function removeFromMenu(itemId: string) {
        if (!confirm("Remover este item do cardápio? Ele permanecerá no banco para histórico de pedidos.")) return;
        setLoadingIds((s) => ({ ...s, [itemId]: true }));

        try {
            // Chama a RPC criada acima
            const { data, error } = await supabase.rpc("delete_menu_item", {
                p_menu_id: menuId,
                p_item_id: itemId,
            });

            if (error) {
                console.error("Erro ao remover item do menu:", error);
                alert("Erro ao remover item do cardápio. Veja console para detalhes.");
            } else {
                // data é jsonb com menu_items_removed
                const removed = (data && (data as any).menu_items_removed) ?? 0;
                if (removed > 0) {
                    // atualizar UI local removendo o item da lista do cardápio
                    setItems((prev) => prev.filter((it) => it.id !== itemId));
                } else {
                    alert("Nenhuma associação removida (item já não pertencia a este cardápio?)");
                }
            }
        } catch (err) {
            console.error("Erro inesperado ao chamar RPC:", err);
            alert("Erro inesperado ao remover item do cardápio.");
        } finally {
            setLoadingIds((s) => ({ ...s, [itemId]: false }));
        }
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Cardápio: {menuName}</h1>
                <Link
                    href={`/menu/${menuId}/add`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                    + Adicionar item
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="text-gray-600">Nenhum item neste cardápio.</div>
            ) : (
                <div className="space-y-4">
                    {items.map((item) => (
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
                                        <h2 className="font-semibold text-lg truncate">{item.name}</h2>
                                        <p className="text-sm text-gray-500">{item.category?.name ?? "Sem categoria"}</p>
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
                                            href={`/menu/${menuId}/item/${item.id}/edit`}
                                            className="px-3 py-1 rounded border text-sm text-gray-700"
                                        >
                                            Editar
                                        </Link>

                                        <button
                                            onClick={() => startTransition(() => removeFromMenu(item.id))}
                                            className="px-3 py-1 rounded border text-sm text-red-600"
                                            disabled={!!loadingIds[item.id]}
                                        >
                                            {loadingIds[item.id] ? "..." : "Remover"}
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
                                        href={`/menu/${menuId}/item/${item.id}/edit`}
                                        className="px-3 py-1 rounded border text-sm text-gray-700"
                                    >
                                        Editar
                                    </Link>

                                    <button
                                        onClick={() => startTransition(() => removeFromMenu(item.id))}
                                        className="px-3 py-1 rounded border text-sm text-red-600"
                                        disabled={!!loadingIds[item.id]}
                                    >
                                        {loadingIds[item.id] ? "..." : "Remover"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

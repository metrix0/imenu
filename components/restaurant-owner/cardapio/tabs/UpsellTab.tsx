"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import ListLoader from "@/components/ui/ListLoader";

type Props = {
    restaurantId: string;
    items: MenuItemType[];
};

export default function UpsellTab({ restaurantId, items }: Props) {
    const [selected, setSelected] = useState<MenuItemType[]>([]);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const bufferRef = useRef<NodeJS.Timeout | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const { data } = await supabase
                .from("upsell")
                .select("item_id, position")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });

            if (data) {
                const ordered = data
                    .map(u => items.find(i => i.id === u.item_id))
                    .filter(Boolean) as MenuItemType[];

                setSelected(ordered);
            }

            setLoading(false);
        };

        load();
    }, [restaurantId, items]);


    // Load upsells (ORDERED)
    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from("upsell")
                .select("item_id, position")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });

            if (!data) return;

            const ordered = data
                .map(u => items.find(i => i.id === u.item_id))
                .filter(Boolean) as MenuItemType[];

            setSelected(ordered);
        };

        load();
    }, [restaurantId, items]);

    // Buffered sync WITH POSITION
    const sync = (next: MenuItemType[]) => {
        setSelected(next);

        if (bufferRef.current) clearTimeout(bufferRef.current);

        bufferRef.current = setTimeout(async () => {
            await supabase.from("upsell").delete().eq("restaurant_id", restaurantId);

            if (next.length) {
                await supabase.from("upsell").insert(
                    next.map((i, index) => ({
                        restaurant_id: restaurantId,
                        item_id: i.id,
                        position: index
                    }))
                );
            }
        }, 500);
    };

    const addItem = (item: MenuItemType) => {
        if (selected.length >= 5) return;
        if (selected.some(i => i.id === item.id)) return;

        sync([...selected, item]);
        setOpen(false);
        setSearch("");
    };

    const removeItem = (id: string) => {
        sync(selected.filter(i => i.id !== id));
    };

    // Drag reorder
    const onDragStart = (index: number) => {
        setDragIndex(index);
    };

    const onDragOver = (index: number) => {
        if (dragIndex === null || dragIndex === index) return;

        const next = [...selected];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);

        setDragIndex(index);
        sync(next);
    };

    const filteredItems = useMemo(() => {
        const q = search.toLowerCase();
        return items.filter(
            i =>
                !selected.some(s => s.id === i.id) &&
                i.name.toLowerCase().includes(q)
        );
    }, [items, selected, search]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">
                    Upsells {selected.length}/5
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                    Estes itens ficarão em destaque no Carrinho, em "Adicione também".{" "}
                    <b>Recomendação: Bebidas e sobremesas</b>
                </p>
            </div>

            {loading && (
                <ListLoader lines={4}/>
            )}
            {
                !loading && (
                    <>
                        {/* Selected items */}
                        <div className="flex gap-3 flex-wrap">
                            {selected.map((item, index) => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={() => onDragStart(index)}
                                    onDragOver={e => {
                                        e.preventDefault();
                                        onDragOver(index);
                                    }}
                                    className="relative border border-gray-200 shadow-sm rounded-xl cursor-move overflow-hidden pb-4 aspect-square w-40"
                                >
                                    {/* Delete (NO DRAG) */}
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            removeItem(item.id);
                                        }}
                                        className="absolute top-2 cursor-pointer right-2 z-10 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center shadow cursor-pointer"
                                    >
                                        <FontAwesomeIcon
                                            icon={icons.faTrash}
                                            className="text-gray-600 text-xs"
                                        />
                                    </button>

                                    <img
                                        src={item.image_url || "/placeholders/item.png"}
                                        alt={item.name}
                                        className={`w-full h-[86%] object-cover rounded-t-xl mb-2 pointer-events-none ${
                                            item.is_available === false ? "grayscale" : ""
                                        }`}
                                    />


                                    {item.is_available === false && (
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/16 to-transparent flex items-center justify-center">
            <span className="text-white text-xs font-semibold uppercase tracking-wide bg-black/60 px-2 py-1 rounded">
                ITEM DESATIVADO
            </span>
                                        </div>
                                    )}

                                    <div className="h-[14%] flex justify-start items-center pointer-events-none">
                                        <p className="text-sm font-medium pl-3 pr-4 truncate">
                                            {item.name}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {selected.length < 5 && (
                                <button
                                    onClick={() => setOpen(true)}
                                    className="border-2 border-dashed rounded-xl w-40 aspect-square flex items-center justify-center text-gray-400 hover:text-gray-500 duration-100 text-xl cursor-pointer hover:bg-gray-50"
                                >
                                    <FontAwesomeIcon icon={icons.faPlus} />
                                </button>
                            )}
                        </div>

                    </>
                )
            }

            {/* Modal */}
            <Modal open={open} onClose={() => setOpen(false)}>
                <div className="p-6 space-y-4 h-[70vh]">
                    <h3 className="text-lg font-semibold">Adicionar Upsell</h3>

                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar produto..."
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                    />

                    <div className="grid px-4 grid-cols-2 sm:grid-cols-3 gap-3 max-h-[58vh] overflow-y-auto">
                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => addItem(item)}
                                className="border border-gray-200 shadow-sm rounded-xl cursor-pointer overflow-hidden pb-4 aspect-square text-left hover:bg-gray-50"
                            >
                                <img
                                    src={item.image_url || "/placeholders/item.png"}
                                    alt={item.name}
                                    className="w-full h-[86%] object-cover rounded-t-xl mb-2"
                                />

                                <div className="h-[14%] flex justify-start items-center">
                                    <p className="text-sm font-medium pl-3 pr-4 truncate">
                                        {item.name}
                                    </p>
                                </div>
                            </button>
                        ))}

                        {filteredItems.length === 0 && (
                            <p className="col-span-full text-sm text-gray-400 text-center py-6">
                                Nenhum item encontrado
                            </p>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

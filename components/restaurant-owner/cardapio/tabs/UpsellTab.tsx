"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { faCheck, faLock } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import ListLoader from "@/components/ui/ListLoader";
import Switch from "@/components/ui/Switch";
import Card from "@/components/ui/Card";
import SaveStatus from "@/components/ui/SaveStatus";
import Tooltip from "@/components/ui/Tooltip";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";

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
    const [automaticEnabled, setAutomaticEnabled] = useState(false);
    const [automaticLoading, setAutomaticLoading] = useState(true);
    const [automaticSaving, setAutomaticSaving] = useState(false);
    const [automaticError, setAutomaticError] = useState<string | null>(null);
    const [plusActive, setPlusActive] = useState<boolean | null>(null);
    const [plusModalOpen, setPlusModalOpen] = useState(false);


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

    useEffect(() => {
        let active = true;
        setAutomaticLoading(true);
        setAutomaticError(null);
        supabase.from("automatic_upsell").select("enabled")
            .eq("restaurant_id", restaurantId).maybeSingle()
            .then(({ data, error }) => {
                if (!active) return;
                if (error) setAutomaticError("Não foi possível carregar o Upsell Automático.");
                else setAutomaticEnabled(Boolean(data?.enabled));
                setAutomaticLoading(false);
            });
        return () => { active = false; };
    }, [restaurantId]);

    const loadPlusAccess = async () => {
        setPlusActive(null);
        try {
            const response = await qrTableAuthenticatedFetch(
                `/api/addons/billing?restaurantId=${encodeURIComponent(restaurantId)}`,
                { cache: "no-store" }
            );
            if (!response.ok) throw new Error("Não foi possível verificar sua assinatura.");
            const data = (await response.json()) as {
                addons?: Array<{ addon: { product_key: string }; active: boolean }>;
            };
            setPlusActive(data.addons?.some(row => row.addon.product_key === "ia_plus" && row.active) === true);
        } catch (error) {
            setAutomaticError(error instanceof Error ? error.message : "Não foi possível verificar sua assinatura.");
        }
    };

    useEffect(() => {
        void loadPlusAccess();
    }, [restaurantId]);

    const toggleAutomatic = async () => {
        if (plusActive === false) {
            setPlusModalOpen(true);
            return;
        }
        if (plusActive === null) return;
        if (automaticSaving || automaticLoading) return;
        const next = !automaticEnabled;
        setAutomaticSaving(true);
        setAutomaticError(null);
        const { error } = await supabase.from("automatic_upsell").upsert(
            { restaurant_id: restaurantId, enabled: next },
            { onConflict: "restaurant_id" }
        );
        if (error) {
            if (error.code === "42501") {
                setPlusActive(false);
                setPlusModalOpen(true);
            }
            setAutomaticError("Não foi possível salvar. Tente novamente.");
        }
        else setAutomaticEnabled(next);
        setAutomaticSaving(false);
    };

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
            <Card className="border border-gray-200 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-medium text-gray-900">Upsell Automático</h2>
                            {plusActive !== null && (
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${plusActive ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-800"}`}>
                                    <FontAwesomeIcon icon={plusActive ? faCheck : faLock} />
                                    {plusActive ? "Plano ativo" : "Incluso no iMenu Plus"}
                                </span>
                            )}
                        </div>
                        <p id="automatic-upsell-description" className="mt-2 text-sm text-gray-500">
                            Analisa periodicamente os itens e categorias mais comprados juntos para sugerir produtos relacionados ao carrinho.
                            Sem histórico suficiente, mantém as sugestões manuais abaixo.
                        </p>
                        {automaticError && <p className="mt-2 text-xs text-red-600" role="alert">{automaticError}</p>}
                    </div>
                    <div className="flex shrink-0 items-start gap-3">
                        {automaticSaving && <SaveStatus status="saving" />}
                        <Tooltip text={plusActive === false ? "Disponível com iMenu Plus. Assine o plano para desbloquear o Upsell Automático." : ""} parentClassName="!block">
                            <Switch
                                checked={plusActive === true && automaticEnabled}
                                aria-label="Upsell Automático"
                                aria-describedby="automatic-upsell-description"
                                disabled={automaticLoading || automaticSaving || plusActive === null}
                                onClick={toggleAutomatic}
                            />
                        </Tooltip>
                    </div>
                </div>
            </Card>
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

            <IaPlusSalesModal
                open={plusModalOpen}
                onClose={() => setPlusModalOpen(false)}
                restaurantId={restaurantId}
                contextMessage="Para ativar o Upsell Automático e recomendar produtos com base nas compras, assine o iMenu Plus."
                onPaid={() => { setPlusModalOpen(false); void loadPlusAccess(); }}
            />

            {/* Modal */}
            <Modal height={660} open={open} onClose={() => setOpen(false)}>
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

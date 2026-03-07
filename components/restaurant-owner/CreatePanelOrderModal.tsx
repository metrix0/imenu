"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import HybridModal from "@/components/ui/HybridModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { formatPrice } from "@/lib/utils/formatPrice";
import Toast from "@/components/ui/Toast";

type Category = {
    id: string;
    name: string;
    position?: number | null;
};

type Item = {
    id: string;
    category_id: string;
    name: string;
    description?: string | null;
    price_cents: number;
    image_path?: string | null;
    is_available: boolean;
    position?: number | null;
};

type Subitem = {
    id: string;
    name: string;
    price_cents: number;
    position?: number | null;
};

type Subcategory = {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    position?: number | null;
    subitems: Subitem[];
};

type SelectedSubitem = {
    subcategoryId: string;
    subcategoryName: string;
    subitemId: string;
    subitemName: string;
    price_cents: number;
};

type SelectedItem = {
    id: string;
    base_item_id: string;
    category_id: string;
    name: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    observation: string | null;
    selectedSubitems: SelectedSubitem[];
};


export default function CreatePanelOrderModal({
                                                  isOpen,
                                                  onClose,
                                                  restaurantId,
                                                  onCreated,
                                              }: {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    onCreated: () => Promise<void> | void;
}) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [itemsByCategory, setItemsByCategory] = useState<Record<string, Item[]>>({});
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);

    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [subcategoriesByItemId, setSubcategoriesByItemId] = useState<Record<string, Subcategory[]>>({});
    const [loadingSubcategoriesByItemId, setLoadingSubcategoriesByItemId] = useState<Record<string, boolean>>({});
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"" | "dinheiro" | "trazer-maquininha">("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
    const [isOrderInfoCollapsed, setIsOrderInfoCollapsed] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type?: "success" | "error" | "info";
    } | null>(null);

    useEffect(() => {
        if (!isOpen || !restaurantId) return;

        const loadMenu = async () => {
            setIsLoadingMenu(true);

            const [{ data: categoriesData, error: categoriesError }, { data: itemsData, error: itemsError }] =
                await Promise.all([
                    supabase
                        .from("categories")
                        .select("id, name, position")
                        .eq("restaurant_id", restaurantId)
                        .order("position", { ascending: true }),
                    supabase
                        .from("items")
                        .select("id, category_id, name, description, price_cents, image_path, is_available, position")
                        .eq("restaurant_id", restaurantId)
                        .eq("is_available", true)
                        .order("position", { ascending: true }),
                ]);

            if (categoriesError) {
                console.error("Erro ao buscar categorias:", categoriesError);
                setCategories([]);
            } else {
                setCategories((categoriesData as Category[]) || []);
            }

            if (itemsError) {
                console.error("Erro ao buscar itens:", itemsError);
                setItemsByCategory({});
            } else {
                const grouped = ((itemsData as Item[]) || []).reduce<Record<string, Item[]>>((acc, item) => {
                    if (!acc[item.category_id]) acc[item.category_id] = [];
                    acc[item.category_id].push(item);
                    return acc;
                }, {});
                setItemsByCategory(grouped);
            }

            setIsLoadingMenu(false);
        };

        loadMenu();
    }, [isOpen, restaurantId]);

    const fetchSubcategoriesForItem = async (baseItemId: string) => {
        if (subcategoriesByItemId[baseItemId]) return subcategoriesByItemId[baseItemId];

        setLoadingSubcategoriesByItemId((prev) => ({ ...prev, [baseItemId]: true }));

        try {
            const res = await fetch(`/api/items/${baseItemId}/subcategories`);
            if (!res.ok) {
                console.error("Erro ao carregar complementos:", await res.text());
                setSubcategoriesByItemId((prev) => ({ ...prev, [baseItemId]: [] }));
                return [];
            }

            const normalized: Subcategory[] = await res.json();
            setSubcategoriesByItemId((prev) => ({ ...prev, [baseItemId]: normalized || [] }));
            return normalized || [];
        } catch (err) {
            console.error("Erro ao carregar subcategorias:", err);
            setSubcategoriesByItemId((prev) => ({ ...prev, [baseItemId]: [] }));
            return [];
        } finally {
            setLoadingSubcategoriesByItemId((prev) => ({ ...prev, [baseItemId]: false }));
        }
    };

    const toggleExpanded = async (selectedItemId: string, baseItemId: string) => {
        const next = !expandedItems[selectedItemId];
        setExpandedItems((prev) => ({ ...prev, [selectedItemId]: next }));

        if (next && !subcategoriesByItemId[baseItemId]) {
            await fetchSubcategoriesForItem(baseItemId);
        }
    };

    const getSelectedSetForSubcategory = (item: SelectedItem, subcategoryId: string) => {
        const set = new Set<string>();
        for (const sub of item.selectedSubitems) {
            if (sub.subcategoryId === subcategoryId) {
                set.add(sub.subitemId);
            }
        }
        return set;
    };

    const recalculateSelectedItem = (
        item: SelectedItem,
        nextSelectedSubitems: SelectedSubitem[],
        nextQty?: number
    ): SelectedItem => {
        const basePrice = (() => {
            const allItems = Object.values(itemsByCategory).flat();
            const sourceItem = allItems.find((i) => i.id === item.base_item_id);
            return sourceItem?.price_cents ?? item.unit_price_cents;
        })();

        const extrasTotal = nextSelectedSubitems.reduce((sum, sub) => sum + sub.price_cents, 0);
        const unit = basePrice + extrasTotal;
        const qty = nextQty ?? item.qty;

        return {
            ...item,
            qty,
            unit_price_cents: unit,
            total_cents: unit * qty,
            selectedSubitems: nextSelectedSubitems,
        };
    };

    const handleAddItem = async (item: Item) => {
        const existing = selectedItems.find((x) => x.base_item_id === item.id);

        // if item already exists → increase quantity
        if (existing) {
            setSelectedItems((prev) =>
                prev.map((x) =>
                    x.base_item_id === item.id
                        ? {
                            ...x,
                            qty: x.qty + 1,
                            total_cents: x.unit_price_cents * (x.qty + 1),
                        }
                        : x
                )
            );
            return;
        }

        // otherwise create new item
        const subcategories = await fetchSubcategoriesForItem(item.id);

        const newId = crypto.randomUUID();

        setSelectedItems((prev) => [
            ...prev,
            {
                id: newId,
                base_item_id: item.id,
                category_id: item.category_id,
                name: item.name,
                qty: 1,
                unit_price_cents: item.price_cents,
                total_cents: item.price_cents,
                observation: null,
                selectedSubitems: [],
            },
        ]);

        const hasSubitems = (subcategories || []).some(
            (sc) => sc.subitems && sc.subitems.length > 0
        );

        setExpandedItems((prev) => ({
            ...prev,
            [newId]: hasSubitems,
        }));
    };
    const changeSelectedItemQty = (id: string, nextQty: number) => {
        if (nextQty <= 0) {
            setSelectedItems((prev) => prev.filter((x) => x.id !== id));
            setExpandedItems((prev) => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
            return;
        }

        setSelectedItems((prev) =>
            prev.map((x) =>
                x.id === id
                    ? {
                        ...x,
                        qty: nextQty,
                        total_cents: x.unit_price_cents * nextQty,
                    }
                    : x
            )
        );
    };

    const changeSelectedItemObservation = (id: string, nextObservation: string) => {
        setSelectedItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, observation: nextObservation }
                    : item
            )
        );
    };

    const toggleSubitemForSelectedItem = (
        selectedItemId: string,
        sc: Subcategory,
        si: Subitem
    ) => {
        setSelectedItems((prev) =>
            prev.map((item) => {
                if (item.id !== selectedItemId) return item;

                const currentForThisSubcategory = item.selectedSubitems.filter(
                    (sub) => sub.subcategoryId === sc.id
                );
                const currentSet = new Set(currentForThisSubcategory.map((sub) => sub.subitemId));
                const single = sc.max_select === 1 || sc.max_select === 0;

                if (single && currentSet.has(si.id)) {
                    const nextSelectedSubitems = item.selectedSubitems.filter(
                        (sub) => !(sub.subcategoryId === sc.id && sub.subitemId === si.id)
                    );
                    return recalculateSelectedItem(item, nextSelectedSubitems);
                }

                if (single) {
                    const withoutThisSubcategory = item.selectedSubitems.filter(
                        (sub) => sub.subcategoryId !== sc.id
                    );

                    const nextSelectedSubitems = [
                        ...withoutThisSubcategory,
                        {
                            subcategoryId: sc.id,
                            subcategoryName: sc.name,
                            subitemId: si.id,
                            subitemName: si.name,
                            price_cents: si.price_cents,
                        },
                    ];

                    return recalculateSelectedItem(item, nextSelectedSubitems);
                }

                if (currentSet.has(si.id)) {
                    const nextSelectedSubitems = item.selectedSubitems.filter(
                        (sub) => !(sub.subcategoryId === sc.id && sub.subitemId === si.id)
                    );
                    return recalculateSelectedItem(item, nextSelectedSubitems);
                }

                let nextSelectedSubitems = [
                    ...item.selectedSubitems,
                    {
                        subcategoryId: sc.id,
                        subcategoryName: sc.name,
                        subitemId: si.id,
                        subitemName: si.name,
                        price_cents: si.price_cents,
                    },
                ];

                const nextCount = nextSelectedSubitems.filter((sub) => sub.subcategoryId === sc.id).length;

                if (sc.max_select > 0 && nextCount > sc.max_select) {
                    const firstExisting = item.selectedSubitems.find((sub) => sub.subcategoryId === sc.id);
                    if (firstExisting) {
                        nextSelectedSubitems = nextSelectedSubitems.filter(
                            (sub) =>
                                !(
                                    sub.subcategoryId === sc.id &&
                                    sub.subitemId === firstExisting.subitemId
                                )
                        );
                    }
                }

                return recalculateSelectedItem(item, nextSelectedSubitems);
            })
        );
    };

    const isMissingRequiredForSelectedItem = (item: SelectedItem) => {
        const subcategories = subcategoriesByItemId[item.base_item_id] || [];

        return subcategories.some((sc) => {
            if (sc.min_select <= 0) return false;
            const count = item.selectedSubitems.filter((sub) => sub.subcategoryId === sc.id).length;
            return count < sc.min_select;
        });
    };

    const itemsTotalCents = useMemo(() => {
        return selectedItems.reduce((sum, item) => sum + item.total_cents, 0);
    }, [selectedItems]);

    const deliveryFeeCents = useMemo(() => {
        const normalized = deliveryFeeInput.replace(/\./g, "").replace(",", ".").trim();
        const value = Number(normalized);

        if (!normalized || Number.isNaN(value) || value < 0) return 0;

        return Math.round(value * 100);
    }, [deliveryFeeInput]);

    const totalCents = itemsTotalCents + deliveryFeeCents;

    const handleSubmit = async () => {
        if (!restaurantId) return;

        if (!customerName.trim()) {
            setToast({
                message: "Informe o nome do cliente.",
                type: "error",
            });
            return;
        }

        if (selectedItems.length === 0) {
            alert("Adicione ao menos 1 item.");
            return;
        }

        const hasMissingRequired = selectedItems.some((item) => isMissingRequiredForSelectedItem(item));
        if (hasMissingRequired) {
            alert("Preencha as opções obrigatórias dos itens.");
            return;
        }

        setIsSubmitting(true);

        try {
            const body = {
                restaurantId,
                customer_name: customerName.trim(),
                customer_phone: customerPhone?.trim() || null,
                customer_address: customerAddress?.trim() || null,
                delivery_fee_cents: deliveryFeeCents,
                delivery_time_minutes: 40,
                paymentMethod: paymentMethod || "dinheiro",
                coupon_discount_cents: 0,
                items: selectedItems.map((item) => ({
                    id: item.id,
                    base_item_id: item.base_item_id,
                    name: item.name,
                    qty: item.qty,
                    unit_price_cents: item.unit_price_cents,
                    total_cents: item.total_cents,
                    observation: item.observation,
                    selectedSubitems: item.selectedSubitems,
                })),
            };

            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error(data);
                alert(data?.error || "Erro ao criar pedido.");
                return;
            }

            setSelectedItems([]);
            setCustomerName("");
            setCustomerPhone("");
            setCustomerAddress("");
            setDeliveryFeeInput("");
            setPaymentMethod("");
            setExpandedItems({});
            setSubcategoriesByItemId({});
            setLoadingSubcategoriesByItemId({});

            await onCreated();
        } catch (err) {
            console.error(err);
            alert("Erro ao criar pedido.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <HybridModal
            open={isOpen}
            onClose={onClose}
            height={0.94}
            xPadding={false}
            className="md:!max-w-6xl min-h-[90vh]"
        >
            <div className="pt-2 md:p-6">
                <div className="flex items-center justify-between mb-4 px-4 md:px-0">
                    <h2 className="text-xl font-bold text-gray-900">Adicionar Pedido</h2>
                    <button onClick={onClose} className="cursor-pointer text-gray-500 hover:text-gray-900">
                        <FontAwesomeIcon icon={icons.faTimes} />
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 md:px-0">
                    <div>
                        {isLoadingMenu ? (
                            <p className="text-gray-500">Carregando itens...</p>
                        ) : (
                            <div className="max-h-[73dvh] overflow-y-auto pr-1 space-y-8">
                                {categories
                                    .filter((cat) => (itemsByCategory[cat.id] || []).length > 0)
                                    .map((cat) => (
                                        <div key={cat.id}>
                                            <h4 className="text-lg font-semibold text-gray-900 mb-4">
                                                {cat.name}
                                            </h4>

                                            <div className="space-y-4">
                                                {(itemsByCategory[cat.id] || []).map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => handleAddItem(item)}
                                                        className="cursor-pointer w-full flex justify-between items-start text-left border-b border-gray-200 pb-4"
                                                    >
                                                        <div className="flex flex-col pr-4 flex-1 items-start justify-start max-w-[100%]">
                                                            <p className="text-sm font-semibold leading-tight">
                                                                {item.name}
                                                            </p>

                                                            <p className="text-sm text-gray-600 line-clamp-2 mt-1 leading-tight">
                                                                {(item.description ?? "").slice(0, 60)}
                                                                {item.description && item.description.length > 60 ? "…" : ""}
                                                            </p>

                                                            <p className="text-sm font-bold mt-2">
                                                                {formatPrice(item.price_cents)}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={() => setIsOrderInfoCollapsed((prev) => !prev)}
                                className="cursor-pointer w-full flex items-center gap-2 mb-3"
                            >
                                <FontAwesomeIcon
                                    icon={icons.faChevronDown}
                                    className={`text-gray-500 transition-transform duration-200 ${
                                        isOrderInfoCollapsed ? "-rotate-90" : "rotate-0"
                                    }`}
                                />
                                <h3 className="font-semibold text-gray-900">Informações do Cliente</h3>
                            </button>

                            <div
                                className={`grid transition-all duration-200 ${
                                    isOrderInfoCollapsed
                                        ? "grid-rows-[0fr] opacity-0"
                                        : "grid-rows-[1fr] opacity-100"
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="space-y-3">
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <input
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="Nome do cliente"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none"
                                            />

                                            <input
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                                placeholder="Telefone (opcional)"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none"
                                            />
                                        </div>

                                        <input
                                            value={customerAddress}
                                            onChange={(e) => setCustomerAddress(e.target.value)}
                                            placeholder="Endereço (opcional)"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none"
                                        />
                                        <div className="flex flex-col md:flex-row gap-3">

                                            <select
                                                value={paymentMethod}
                                                onChange={(e) =>
                                                    setPaymentMethod(e.target.value as "" | "dinheiro" | "trazer-maquininha")
                                                }
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none bg-white"
                                            >
                                                <option value="">Forma de pgt. (opcional)</option>
                                                <option value="dinheiro">Dinheiro</option>
                                                <option value="trazer-maquininha">Trazer maquininha</option>
                                            </select>
                                            <input
                                                value={deliveryFeeInput}
                                                onChange={(e) => setDeliveryFeeInput(e.target.value)}
                                                placeholder="Taxa (opcional)"
                                                inputMode="decimal"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`mt-6 overflow-y-auto pr-1 ${isOrderInfoCollapsed ? "max-h-[65vh]" : "max-h-[42dvh]"}`}>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Itens selecionados</h3>

                                {selectedItems.length === 0 ? (
                                    <p className="text-gray-500">Nenhum item selecionado.</p>
                                ) : (
                                    <div className="space-y-3 pb-6">
                                        {selectedItems.map((item) => {
                                            const subcategories = subcategoriesByItemId[item.base_item_id] || [];
                                            const isExpanded = !!expandedItems[item.id];
                                            const isLoadingSubcategories = !!loadingSubcategoriesByItemId[item.base_item_id];
                                            const missingRequired = isMissingRequiredForSelectedItem(item);

                                            return (
                                                <div key={item.id} className={`border border-gray-200 rounded-xl p-3`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-gray-900">{item.name}</div>

                                                            <div className="text-sm text-gray-500 mt-1">
                                                                {formatPrice(item.unit_price_cents)} cada
                                                            </div>

                                                            {!isExpanded && item.selectedSubitems.length > 0 && (
                                                                <div className="mt-2 text-sm text-gray-500 space-y-1">
                                                                    {item.selectedSubitems.map((sub) => (
                                                                        <div key={`${item.id}-${sub.subitemId}`}>
                                                                            + {sub.subitemName}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {!isExpanded && item.observation && (
                                                                <div className="mt-2 text-sm text-gray-500">
                                                                    Obs: {item.observation}
                                                                </div>
                                                            )}

                                                            {!isExpanded && missingRequired && (
                                                                <div className="mt-2 text-xs text-warning">
                                                                    Faltam opções obrigatórias.
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => toggleExpanded(item.id, item.base_item_id)}
                                                            className="text-sm text-brand font-medium cursor-pointer whitespace-nowrap"
                                                        >
                                                            {isExpanded ? "Fechar opções" : "Abrir opções"}
                                                        </button>
                                                    </div>

                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    changeSelectedItemQty(
                                                                        item.id,
                                                                        item.qty === 1 ? 0 : item.qty - 1
                                                                    )
                                                                }
                                                                className="w-4 h-4 cursor-pointer rounded-lg flex items-center justify-center"
                                                            >
                                                                <FontAwesomeIcon
                                                                    icon={item.qty === 1 ? icons.faTrash : icons.faMinus}
                                                                    className="text-sm"
                                                                />
                                                            </button>

                                                            <span className="min-w-5 text-center">{item.qty}</span>

                                                            <button
                                                                type="button"
                                                                onClick={() => changeSelectedItemQty(item.id, item.qty + 1)}
                                                                className="w-4 h-4 cursor-pointer  rounded-lg flex items-center justify-center"
                                                            >
                                                                <FontAwesomeIcon icon={icons.faPlus} className="text-sm cursor-pointer"/>
                                                            </button>
                                                        </div>

                                                        <div className="text-right font-semibold text-gray-900">
                                                            {formatPrice(item.total_cents)}
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="mt-4 border-t border-gray-100 pt-4">
                                                            {isLoadingSubcategories ? (
                                                                <div className="text-sm text-gray-500 mb-4">
                                                                    Carregando complementos...
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {subcategories.map((sc) => {
                                                                        const selectedSet = getSelectedSetForSubcategory(item, sc.id);
                                                                        const isSingle = sc.max_select === 1 || sc.max_select === 0;

                                                                        return (
                                                                            <div key={sc.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                                                                <div className="bg-gray-50 px-4 py-3 flex justify-between gap-3">
                                                                                    <div>
                                                                                        <p className="font-semibold text-gray-700">
                                                                                            {sc.name}
                                                                                        </p>
                                                                                        <p className="text-[13px] text-gray-500">
                                                                                            {sc.max_select > 0
                                                                                                ? `Escolha até ${sc.max_select}`
                                                                                                : "Escolha o quanto quiser"}
                                                                                        </p>
                                                                                    </div>

                                                                                    {sc.min_select > 0 && (
                                                                                        <span className="text-[11px] text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                                                                                            OBRIGATÓRIO
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                <div>
                                                                                    {[...sc.subitems]
                                                                                        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                                                                        .map((si) => {
                                                                                            const isSelected = selectedSet.has(si.id);

                                                                                            return (
                                                                                                <button
                                                                                                    key={si.id}
                                                                                                    type="button"
                                                                                                    onClick={() =>
                                                                                                        toggleSubitemForSelectedItem(item.id, sc, si)
                                                                                                    }
                                                                                                    className="cursor-pointer w-full px-4 py-3 flex justify-between items-center text-left border-t border-gray-100 first:border-t-0"
                                                                                                >
                                                                                                    <div className="pr-4">
                                                                                                        <p className="font-medium text-sm text-gray-900">
                                                                                                            {si.name.replace(/\n/g, " ")}
                                                                                                        </p>

                                                                                                        {si.price_cents > 0 && (
                                                                                                            <p className="text-[13px] text-gray-500">
                                                                                                                + {formatPrice(si.price_cents)}
                                                                                                            </p>
                                                                                                        )}
                                                                                                    </div>

                                                                                                    <div className="flex items-center">
                                                                                                        {isSingle ? (
                                                                                                            <span
                                                                                                                className={`w-7 h-7 rounded-full border flex items-center justify-center ${
                                                                                                                    isSelected
                                                                                                                        ? "border-brand bg-brand text-white"
                                                                                                                        : "border-gray-300 bg-gray-100 text-gray-400"
                                                                                                                }`}
                                                                                                            >
                                                                                                                <FontAwesomeIcon icon={icons.faCheck} className="text-xs" />
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <span
                                                                                                                className={`w-7 h-7 rounded-full border flex items-center justify-center ${
                                                                                                                    isSelected
                                                                                                                        ? "border-brand bg-brand text-white"
                                                                                                                        : "border-gray-300 bg-gray-100 text-gray-400"
                                                                                                                }`}
                                                                                                            >
                                                                                                                {isSelected ? "–" : "+"}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    <textarea
                                                                        value={item.observation || ""}
                                                                        onChange={(e) =>
                                                                            changeSelectedItemObservation(item.id, e.target.value.slice(0, 140))
                                                                        }
                                                                        placeholder="Observação"
                                                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none resize-none text-sm"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div className="mt-6 flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-gray-500">Total</div>
                                                <div className="text-xl font-bold text-gray-900">
                                                    {formatPrice(totalCents)}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={handleSubmit}
                                                loading={isSubmitting}
                                                className="bg-brand text-white border-transparent hover:opacity-90 shadow-sm"
                                            >
                                                Criar pedido
                                            </Button>
                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </HybridModal>
    );
}
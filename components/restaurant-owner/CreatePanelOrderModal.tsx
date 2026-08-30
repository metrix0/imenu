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

type RestaurantTable = {
    id: string;
    name: string;
    public_token: string;
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
    stock_enabled?: boolean | null;
    stock_quantity?: number | null;
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
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);

    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [subcategoriesByItemId, setSubcategoriesByItemId] = useState<Record<string, Subcategory[]>>({});
    const [loadingSubcategoriesByItemId, setLoadingSubcategoriesByItemId] = useState<Record<string, boolean>>({});
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [selectedTableId, setSelectedTableId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"" | "dinheiro" | "trazer-maquininha">("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
    const [isOrderInfoCollapsed, setIsOrderInfoCollapsed] = useState(false);
    const [mobileView, setMobileView] = useState<"menu" | "order">("menu");
    const [menuSearch, setMenuSearch] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type?: "success" | "error" | "info";
    } | null>(null);

    useEffect(() => {
        if (!isOpen || !restaurantId) return;

        const loadMenu = async () => {
            setIsLoadingMenu(true);

            const [
                { data: categoriesData, error: categoriesError },
                { data: itemsData, error: itemsError },
                { data: tablesData, error: tablesError },
            ] = await Promise.all([
                supabase
                    .from("categories")
                    .select("id, name, position")
                    .eq("restaurant_id", restaurantId)
                    .order("position", { ascending: true }),
                supabase
                    .from("items")
                    .select("id, category_id, name, description, price_cents, image_path, is_available, position, stock_enabled, stock_quantity")
                    .eq("restaurant_id", restaurantId)
                    .eq("is_available", true)
                    .order("position", { ascending: true }),
                supabase
                    .from("restaurant_tables")
                    .select("id, name, public_token, position")
                    .eq("restaurant_id", restaurantId)
                    .eq("is_active", true)
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

            if (tablesError) {
                console.error("Erro ao buscar mesas:", tablesError);
                setTables([]);
            } else {
                setTables((tablesData as RestaurantTable[]) || []);
            }

            setIsLoadingMenu(false);
        };

        loadMenu();
    }, [isOpen, restaurantId]);

    useEffect(() => {
        if (!isOpen) return;
        setMobileView("menu");
        setMenuSearch("");
    }, [isOpen]);

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

    const selectedTable = useMemo(
        () => tables.find((table) => table.id === selectedTableId) || null,
        [selectedTableId, tables]
    );

    const totalCents = itemsTotalCents + (selectedTable ? 0 : deliveryFeeCents);

    const selectedItemCount = useMemo(
        () => selectedItems.reduce((sum, item) => sum + item.qty, 0),
        [selectedItems]
    );

    const selectedQuantityByItemId = useMemo(() => {
        return selectedItems.reduce<Record<string, number>>((acc, item) => {
            acc[item.base_item_id] = (acc[item.base_item_id] || 0) + item.qty;
            return acc;
        }, {});
    }, [selectedItems]);

    const visibleMenuCategories = useMemo(() => {
        const query = menuSearch.trim().toLocaleLowerCase("pt-BR");

        return categories
            .map((category) => ({
                category,
                items: (itemsByCategory[category.id] || []).filter((item) => {
                    if (!query) return true;
                    return `${item.name} ${item.description || ""}`
                        .toLocaleLowerCase("pt-BR")
                        .includes(query);
                }),
            }))
            .filter(({ items }) => items.length > 0);
    }, [categories, itemsByCategory, menuSearch]);

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
                customer_address: selectedTable
                    ? null
                    : customerAddress?.trim() || null,
                delivery_fee_cents: selectedTable ? 0 : deliveryFeeCents,
                delivery_time_minutes: selectedTable ? 0 : 40,
                paymentMethod: selectedTable
                    ? undefined
                    : paymentMethod || "dinheiro",
                is_delivery: selectedTable ? "mesa" : undefined,
                table_id: selectedTable?.id,
                table_token: selectedTable?.public_token,
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
            setSelectedTableId("");
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
            height={0.96}
            xPadding={false}
            contentClassName="!overflow-hidden !pb-0"
            className="md:!h-[88dvh] md:!max-h-[900px] md:!max-w-7xl md:!overflow-hidden"
        >
            <div className="flex h-full min-h-0 flex-col bg-white">
                <div className="shrink-0 border-b border-gray-100 bg-white px-4 pb-4 pt-4 md:px-6 md:py-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                                Adicionar Pedido
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Selecione os itens e finalize os dados do pedido.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                            <FontAwesomeIcon icon={icons.faTimes} />
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 rounded-xl bg-gray-100 p-1 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileView("menu")}
                            className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                                mobileView === "menu"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500"
                            }`}
                        >
                            Cardápio
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileView("order")}
                            className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                                mobileView === "order"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500"
                            }`}
                        >
                            Pedido{selectedItemCount > 0 ? ` (${selectedItemCount})` : ""}
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(390px,0.88fr)]">
                    <section
                        className={`${
                            mobileView === "menu" ? "flex" : "hidden"
                        } min-h-0 flex-col bg-white lg:flex lg:border-r lg:border-gray-100`}
                    >
                        <div className="shrink-0 px-4 pb-3 pt-4 md:px-6">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="font-semibold text-gray-900">Cardápio</h3>
                                {selectedItemCount > 0 && (
                                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                                        {selectedItemCount} {selectedItemCount === 1 ? "item" : "itens"}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <FontAwesomeIcon
                                    icon={icons.faMagnifyingGlass}
                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                                />
                                <input
                                    value={menuSearch}
                                    onChange={(event) => setMenuSearch(event.target.value)}
                                    placeholder="Buscar item..."
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10"
                                />
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 md:px-6">
                            {isLoadingMenu ? (
                                <div className="flex min-h-40 items-center justify-center text-sm text-gray-500">
                                    Carregando itens...
                                </div>
                            ) : visibleMenuCategories.length === 0 ? (
                                <div className="flex min-h-40 flex-col items-center justify-center text-center">
                                    <FontAwesomeIcon
                                        icon={icons.faMagnifyingGlass}
                                        className="mb-3 text-xl text-gray-300"
                                    />
                                    <p className="text-sm font-medium text-gray-600">
                                        Nenhum item encontrado
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-7">
                                    {visibleMenuCategories.map(({ category, items }) => (
                                        <div key={category.id}>
                                            <h4 className="sticky top-0 z-10 mb-2 bg-white/95 py-2 text-sm font-bold uppercase tracking-wide text-gray-500 backdrop-blur-sm">
                                                {category.name}
                                            </h4>

                                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                                {items.map((item, index) => {
                                                    const selectedQty = selectedQuantityByItemId[item.id] || 0;

                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => void handleAddItem(item)}
                                                            className={`flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-gray-50 active:bg-gray-100 ${
                                                                index > 0 ? "border-t border-gray-100" : ""
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="truncate text-sm font-semibold text-gray-900 md:text-base">
                                                                        {item.name}
                                                                    </p>
                                                                    {selectedQty > 0 && (
                                                                        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                                                                            {selectedQty}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {item.description && (
                                                                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                                                                        {item.description}
                                                                    </p>
                                                                )}
                                                                <p className="mt-2 text-sm font-bold text-gray-900">
                                                                    {formatPrice(item.price_cents)}
                                                                </p>
                                                            </div>

                                                            <div className="flex shrink-0 items-center gap-3">
                                                                {item.stock_enabled && (
                                                                    <span className="hidden text-xs text-gray-400 sm:inline">
                                                                        Estoque: {item.stock_quantity}
                                                                    </span>
                                                                )}
                                                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                                                                    <FontAwesomeIcon icon={icons.faPlus} className="text-sm" />
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedItemCount > 0 && (
                            <div className="shrink-0 border-t border-gray-100 bg-white p-4 lg:hidden">
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => setMobileView("order")}
                                >
                                    Ver pedido ({selectedItemCount}) · {formatPrice(totalCents)}
                                </Button>
                            </div>
                        )}
                    </section>

                    <section
                        className={`${
                            mobileView === "order" ? "flex" : "hidden"
                        } min-h-0 flex-col bg-gray-50/50 lg:flex`}
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                            <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setIsOrderInfoCollapsed((prev) => !prev)}
                                    className="mb-3 flex w-full cursor-pointer items-center justify-between gap-3 text-left"
                                >
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            Informações do pedido
                                        </h3>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            Cliente, mesa e pagamento
                                        </p>
                                    </div>
                                    <FontAwesomeIcon
                                        icon={icons.faChevronDown}
                                        className={`text-gray-400 transition-transform duration-200 ${
                                            isOrderInfoCollapsed ? "-rotate-90" : "rotate-0"
                                        }`}
                                    />
                                </button>

                                <div
                                    className={`grid transition-all duration-200 ${
                                        isOrderInfoCollapsed
                                            ? "grid-rows-[0fr] opacity-0"
                                            : "grid-rows-[1fr] opacity-100"
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="space-y-3 pt-1">
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <input
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    placeholder="Nome do cliente *"
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                />

                                                <input
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                    placeholder="Telefone (opcional)"
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                />
                                            </div>

                                            {tables.length > 0 && (
                                                <div className="relative w-full">
                                                    <select
                                                        value={selectedTableId}
                                                        onChange={(e) => setSelectedTableId(e.target.value)}
                                                        className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-gray-700 outline-none transition hover:border-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                    >
                                                        <option value="">Entrega / balcão</option>
                                                        {tables.map((table) => (
                                                            <option key={table.id} value={table.id}>
                                                                {table.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <FontAwesomeIcon
                                                        icon={icons.faChevronDown}
                                                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                                                    />
                                                </div>
                                            )}

                                            {selectedTable ? (
                                                <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        Pedido para {selectedTable.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Sem endereço, taxa de entrega ou forma de pagamento antecipada.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    <input
                                                        value={customerAddress}
                                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                                        placeholder="Endereço (opcional)"
                                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                    />

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <div className="relative w-full">
                                                            <select
                                                                value={paymentMethod}
                                                                onChange={(e) =>
                                                                    setPaymentMethod(e.target.value as "" | "dinheiro" | "trazer-maquininha")
                                                                }
                                                                className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-gray-700 outline-none transition hover:border-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                            >
                                                                <option value="">Forma de pagamento (opcional)</option>
                                                                <option value="dinheiro">Dinheiro</option>
                                                                <option value="trazer-maquininha">Trazer maquininha</option>
                                                            </select>
                                                            <FontAwesomeIcon
                                                                icon={icons.faChevronDown}
                                                                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                                                            />
                                                        </div>

                                                        <input
                                                            value={deliveryFeeInput}
                                                            onChange={(e) => setDeliveryFeeInput(e.target.value)}
                                                            placeholder="Taxa de entrega (opcional)"
                                                            inputMode="decimal"
                                                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-2 flex items-center justify-between gap-3">
                                <h3 className="font-semibold text-gray-900">Itens selecionados</h3>
                                <button
                                    type="button"
                                    onClick={() => setMobileView("menu")}
                                    className="cursor-pointer text-sm font-medium text-brand lg:hidden"
                                >
                                    + Adicionar itens
                                </button>
                            </div>

                            {selectedItems.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setMobileView("menu")}
                                    className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white px-4 py-10 text-center transition hover:border-brand/40"
                                >
                                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                                        <FontAwesomeIcon icon={icons.faPlus} />
                                    </span>
                                    <span className="text-sm font-semibold text-gray-700">
                                        Adicione itens ao pedido
                                    </span>
                                    <span className="mt-1 text-xs text-gray-500 lg:hidden">
                                        Toque para voltar ao cardápio
                                    </span>
                                </button>
                            ) : (
                                <div className="space-y-3 pb-3">
                                    {selectedItems.map((item) => {
                                        const subcategories = subcategoriesByItemId[item.base_item_id] || [];
                                        const isExpanded = !!expandedItems[item.id];
                                        const isLoadingSubcategories = !!loadingSubcategoriesByItemId[item.base_item_id];
                                        const missingRequired = isMissingRequiredForSelectedItem(item);

                                        return (
                                            <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900">{item.name}</div>

                                                        <div className="mt-1 text-sm text-gray-500">
                                                            {formatPrice(item.unit_price_cents)} cada
                                                        </div>

                                                        {!isExpanded && item.selectedSubitems.length > 0 && (
                                                            <div className="mt-2 space-y-1 text-sm text-gray-500">
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
                                                            <div className="mt-2 text-xs font-medium text-warning">
                                                                Faltam opções obrigatórias.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => void toggleExpanded(item.id, item.base_item_id)}
                                                        className="cursor-pointer whitespace-nowrap text-sm font-medium text-brand"
                                                    >
                                                        {isExpanded ? "Fechar" : "Opções"}
                                                    </button>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                                                    <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                changeSelectedItemQty(
                                                                    item.id,
                                                                    item.qty === 1 ? 0 : item.qty - 1
                                                                )
                                                            }
                                                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:shadow-sm"
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={item.qty === 1 ? icons.faTrash : icons.faMinus}
                                                                className="text-sm"
                                                            />
                                                        </button>

                                                        <span className="min-w-6 text-center text-sm font-semibold">{item.qty}</span>

                                                        <button
                                                            type="button"
                                                            onClick={() => changeSelectedItemQty(item.id, item.qty + 1)}
                                                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:shadow-sm"
                                                        >
                                                            <FontAwesomeIcon icon={icons.faPlus} className="text-sm" />
                                                        </button>
                                                    </div>

                                                    <div className="text-right font-bold text-gray-900">
                                                        {formatPrice(item.total_cents)}
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                                        {isLoadingSubcategories ? (
                                                            <div className="mb-4 text-sm text-gray-500">
                                                                Carregando complementos...
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {subcategories.map((sc) => {
                                                                    const selectedSet = getSelectedSetForSubcategory(item, sc.id);
                                                                    const isSingle = sc.max_select === 1 || sc.max_select === 0;

                                                                    return (
                                                                        <div key={sc.id} className="overflow-hidden rounded-xl border border-gray-100">
                                                                            <div className="flex justify-between gap-3 bg-gray-50 px-4 py-3">
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
                                                                                    <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-600">
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
                                                                                                className="flex w-full cursor-pointer items-center justify-between border-t border-gray-100 px-4 py-3 text-left first:border-t-0 hover:bg-gray-50"
                                                                                            >
                                                                                                <div className="pr-4">
                                                                                                    <p className="text-sm font-medium text-gray-900">
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
                                                                                                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                                                                                                                isSelected
                                                                                                                    ? "border-brand bg-brand text-white"
                                                                                                                    : "border-gray-300 bg-gray-100 text-gray-400"
                                                                                                            }`}
                                                                                                        >
                                                                                                            <FontAwesomeIcon icon={icons.faCheck} className="text-xs" />
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span
                                                                                                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
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
                                                                    className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                                    rows={3}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 md:px-6">
                            <div className="flex items-center gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-gray-500">Total do pedido</div>
                                    <div className="truncate text-xl font-bold text-gray-900">
                                        {formatPrice(totalCents)}
                                    </div>
                                </div>

                                <Button
                                    onClick={() => void handleSubmit()}
                                    loading={isSubmitting}
                                    disabled={selectedItems.length === 0}
                                    className="min-w-36 bg-brand text-white border-transparent hover:opacity-90 shadow-sm"
                                >
                                    Criar pedido
                                </Button>
                            </div>
                        </div>
                    </section>
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
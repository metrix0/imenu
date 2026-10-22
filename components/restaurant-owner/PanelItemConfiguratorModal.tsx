"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Textarea from "@/components/ui/Textarea";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import type {
    PizzaCatalogItem,
    PizzaSelection,
    Subcategory,
} from "@/lib/types/types";
import {
    isPizzaItem,
    parsePizzaSettings,
    pricePizza,
    SAME_CATEGORY_PIZZA_ERROR,
} from "@/lib/pizza/pricing";
import { formatPrice } from "@/lib/utils/formatPrice";
import { icons } from "@/lib/utils/fontawesome";

export type PanelOrderMenuItem = {
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

export type PanelOrderSubitem = {
    id: string;
    name: string;
    price_cents: number;
    position?: number | null;
};

export type PanelOrderSubcategory = {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    allow_multiple_units?: boolean;
    position?: number | null;
    subitems: PanelOrderSubitem[];
};

export type PanelOrderSelectedSubitem = {
    subcategoryId: string;
    subcategoryName: string;
    subitemId: string;
    subitemName: string;
    price_cents: number;
    quantity?: number;
};

export type PanelOrderConfiguredItem = {
    id: string;
    base_item_id: string;
    category_id: string;
    name: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    observation: string | null;
    selectedSubitems: PanelOrderSelectedSubitem[];
    pizza?: PizzaSelection;
};

type Props = {
    restaurantId: string;
    item: PanelOrderMenuItem;
    subcategories: PanelOrderSubcategory[];
    loading: boolean;
    pizzaSettings: unknown;
    onClose: () => void;
    onAdd: (item: PanelOrderConfiguredItem) => void;
};

function normalizeSubcategories(
    itemId: string,
    groups: PanelOrderSubcategory[]
): Subcategory[] {
    return groups.map((group, groupIndex) => ({
        id: group.id,
        item_id: itemId,
        name: group.name,
        description: null,
        min_select: group.min_select,
        max_select: group.max_select,
        allow_multiple_units: group.allow_multiple_units === true,
        position: group.position ?? groupIndex,
        subitems: group.subitems.map((subitem, subitemIndex) => ({
            id: subitem.id,
            item_subcategory_id: group.id,
            name: subitem.name,
            description: null,
            price_cents: subitem.price_cents,
            is_available: true,
            position: subitem.position ?? subitemIndex,
        })),
    }));
}

export default function PanelItemConfiguratorModal({
    restaurantId,
    item,
    subcategories,
    loading,
    pizzaSettings: rawPizzaSettings,
    onClose,
    onAdd,
}: Props) {
    const [qty, setQty] = useState(1);
    const [observation, setObservation] = useState("");
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const [selectedQuantities, setSelectedQuantities] = useState<
        Record<string, Record<string, number>>
    >({});
    const [flavorCount, setFlavorCount] = useState(1);
    const [extraFlavors, setExtraFlavors] = useState<PizzaCatalogItem[]>([]);
    const [flavorSearch, setFlavorSearch] = useState(false);
    const [flavorSearchText, setFlavorSearchText] = useState("");
    const [catalog, setCatalog] = useState<PizzaCatalogItem[]>([]);
    const [loadingFlavors, setLoadingFlavors] = useState(false);
    const [pizzaError, setPizzaError] = useState("");
    const [pizzaSettings, setPizzaSettings] = useState(() =>
        parsePizzaSettings(rawPizzaSettings)
    );

    useEffect(() => {
        setQty(1);
        setObservation("");
        setSelected({});
        setSelectedQuantities({});
        setFlavorCount(1);
        setExtraFlavors([]);
        setFlavorSearch(false);
        setFlavorSearchText("");
        setCatalog([]);
        setLoadingFlavors(false);
        setPizzaError("");
        setPizzaSettings(parsePizzaSettings(rawPizzaSettings));
    }, [item.id, rawPizzaSettings]);

    const normalizedGroups = useMemo(
        () => normalizeSubcategories(item.id, subcategories),
        [item.id, subcategories]
    );

    const normalizedItem = useMemo<PizzaCatalogItem>(
        () => ({
            id: item.id,
            category_id: item.category_id,
            name: item.name,
            description: item.description ?? null,
            price_cents: item.price_cents,
            image_path: item.image_path ?? null,
            is_available: item.is_available,
            position: item.position ?? 0,
            subcategories: normalizedGroups,
            pizza_same_category_only: pizzaSettings.same_category_only,
        }),
        [item, normalizedGroups, pizzaSettings.same_category_only]
    );

    const eligibleForPizza = isPizzaItem(normalizedItem, pizzaSettings);

    const getQuantityGroupCount = (group?: Record<string, number>) =>
        Object.values(group || {}).reduce(
            (sum, currentQuantity) => sum + currentQuantity,
            0
        );

    const changeSubitemQuantity = (
        group: PanelOrderSubcategory,
        subitem: PanelOrderSubitem,
        delta: number
    ) => {
        setSelectedQuantities((previous) => {
            const currentGroup = { ...(previous[group.id] || {}) };
            const currentQuantity = currentGroup[subitem.id] || 0;
            const currentGroupCount = getQuantityGroupCount(currentGroup);

            if (
                delta > 0 &&
                group.max_select > 0 &&
                currentGroupCount >= group.max_select
            ) {
                return previous;
            }

            const nextQuantity = Math.max(
                0,
                Math.min(99, currentQuantity + delta)
            );

            if (nextQuantity === 0) delete currentGroup[subitem.id];
            else currentGroup[subitem.id] = nextQuantity;

            return { ...previous, [group.id]: currentGroup };
        });
    };

    const toggleSubitem = (
        group: PanelOrderSubcategory,
        subitem: PanelOrderSubitem
    ) => {
        setSelected((previous) => {
            const current = new Set(previous[group.id] || []);
            const single = group.max_select === 1 || group.max_select === 0;

            if (single && current.has(subitem.id)) {
                current.delete(subitem.id);
                return { ...previous, [group.id]: current };
            }

            if (single) {
                current.clear();
                current.add(subitem.id);
            } else if (current.has(subitem.id)) {
                current.delete(subitem.id);
            } else {
                current.add(subitem.id);
                if (group.max_select > 0 && current.size > group.max_select) {
                    const first = current.values().next().value;
                    if (first) current.delete(first);
                }
            }

            return { ...previous, [group.id]: current };
        });
    };

    const selectedSubitems = useMemo<PanelOrderSelectedSubitem[]>(() => {
        const result: PanelOrderSelectedSubitem[] = [];

        for (const group of subcategories) {
            if (group.allow_multiple_units) {
                const quantities = selectedQuantities[group.id] || {};
                for (const subitem of group.subitems) {
                    const quantity = quantities[subitem.id] || 0;
                    if (quantity > 0) {
                        result.push({
                            subcategoryId: group.id,
                            subcategoryName: group.name,
                            subitemId: subitem.id,
                            subitemName: subitem.name,
                            price_cents: subitem.price_cents,
                            quantity,
                        });
                    }
                }
                continue;
            }

            const ids = selected[group.id];
            if (!ids) continue;

            for (const subitem of group.subitems) {
                if (ids.has(subitem.id)) {
                    result.push({
                        subcategoryId: group.id,
                        subcategoryName: group.name,
                        subitemId: subitem.id,
                        subitemName: subitem.name,
                        price_cents: subitem.price_cents,
                    });
                }
            }
        }

        return result;
    }, [selected, selectedQuantities, subcategories]);

    const extrasTotal = useMemo(
        () =>
            selectedSubitems.reduce(
                (sum, subitem) =>
                    sum +
                    subitem.price_cents * (subitem.quantity ?? 1),
                0
            ),
        [selectedSubitems]
    );

    const missingRequired = useMemo(
        () =>
            subcategories.some((group) => {
                if (group.min_select <= 0) return false;

                if (group.allow_multiple_units) {
                    return (
                        getQuantityGroupCount(
                            selectedQuantities[group.id]
                        ) < group.min_select
                    );
                }

                return (selected[group.id]?.size || 0) < group.min_select;
            }),
        [selected, selectedQuantities, subcategories]
    );

    const catalogFirstFlavor =
        catalog.find((candidate) => candidate.id === item.id) || null;
    const firstFlavor = catalogFirstFlavor || normalizedItem;
    const flavors = [firstFlavor, ...extraFlavors];
    const needsNextFlavor =
        eligibleForPizza && flavorCount > flavors.length;

    let pizzaQuote: ReturnType<typeof pricePizza> | undefined;
    let quoteError = "";

    if (extraFlavors.length > 0) {
        try {
            pizzaQuote = pricePizza(
                flavors,
                selectedSubitems,
                pizzaSettings.pricing_rule
            );
        } catch (error) {
            quoteError =
                error instanceof Error
                    ? error.message
                    : "Combinação indisponível.";
        }
    }

    const unitPrice =
        pizzaQuote?.unit_price_cents ?? item.price_cents + extrasTotal;
    const total = unitPrice * qty;

    const showFlavorSearch = async () => {
        setPizzaError("");

        if (!catalog.length) {
            setLoadingFlavors(true);
            try {
                const response = await fetch(
                    `/api/restaurants/${restaurantId}/pizza/catalog`,
                    { cache: "no-store" }
                );
                const data = (await response.json()) as {
                    error?: string;
                    settings?: unknown;
                    items?: PizzaCatalogItem[];
                };

                if (!response.ok) {
                    throw new Error(
                        data.error || "Não foi possível carregar os sabores."
                    );
                }

                const nextCatalog = data.items || [];
                if (!nextCatalog.some((candidate) => candidate.id === item.id)) {
                    throw new Error(
                        "Este item não está mais disponível no modo pizza."
                    );
                }

                setCatalog(nextCatalog);
                if (data.settings) {
                    setPizzaSettings(parsePizzaSettings(data.settings));
                }
            } catch (error) {
                setPizzaError(
                    error instanceof Error
                        ? error.message
                        : "Não foi possível carregar os sabores."
                );
                return;
            } finally {
                setLoadingFlavors(false);
            }
        }

        setFlavorSearch(true);
    };

    const handlePrimaryAction = () => {
        if (loading || missingRequired || quoteError || pizzaError) return;

        if (needsNextFlavor) {
            void showFlavorSearch();
            return;
        }

        onAdd({
            id: crypto.randomUUID(),
            base_item_id: item.id,
            category_id: item.category_id,
            name: pizzaQuote?.name ?? item.name,
            qty,
            unit_price_cents: unitPrice,
            total_cents: total,
            observation: observation.trim() || null,
            selectedSubitems:
                pizzaQuote?.selectedSubitems ?? selectedSubitems,
            pizza: pizzaQuote?.pizza,
        });
    };


    if (flavorSearch) {
        const query = flavorSearchText.trim().toLocaleLowerCase("pt-BR");
        const candidates = catalog
            .filter((candidate) =>
                !query ||
                `${candidate.name} ${candidate.description || ""}`
                    .toLocaleLowerCase("pt-BR")
                    .includes(query)
            )
            .map((candidate) => {
                try {
                    return {
                        candidate,
                        price: pricePizza(
                            [...flavors, candidate],
                            selectedSubitems,
                            pizzaSettings.pricing_rule
                        ).unit_price_cents,
                        error: "",
                    };
                } catch (error) {
                    return {
                        candidate,
                        price: undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Combinação indisponível.",
                    };
                }
            })
            .filter(({ error }) => error !== SAME_CATEGORY_PIZZA_ERROR);

        return (
            <div className="flex h-full min-h-0 flex-col bg-white">
                <div className="shrink-0 border-b border-gray-100 px-4 py-4 md:px-6">
                    <button
                        type="button"
                        onClick={() => {
                            setFlavorSearch(false);
                            setFlavorSearchText("");
                        }}
                        className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
                    >
                        <FontAwesomeIcon icon={icons.faChevronLeft} />
                        Voltar
                    </button>

                    <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Pizza
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-gray-900">
                            Escolha o sabor {flavors.length + 1} de {flavorCount}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            O preço final considera os sabores escolhidos e os complementos do primeiro sabor.
                        </p>
                    </div>

                    <div className="relative mt-4">
                        <FontAwesomeIcon
                            icon={icons.faMagnifyingGlass}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                        />
                        <Input
                            inline
                            value={flavorSearchText}
                            onChange={(event) =>
                                setFlavorSearchText(event.target.value)
                            }
                            placeholder="Buscar sabores..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
                    {candidates.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center text-sm text-gray-500">
                            Nenhum sabor disponível.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {candidates.map(({ candidate, price, error }) => (
                                <button
                                    key={candidate.id}
                                    type="button"
                                    disabled={Boolean(error)}
                                    onClick={() => {
                                        if (error) return;
                                        setExtraFlavors((previous) => [
                                            ...previous,
                                            candidate,
                                        ]);
                                        setFlavorSearch(false);
                                        setFlavorSearchText("");
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    <img
                                        src={candidate.image_public_url || "/placeholders/item.png"}
                                        alt=""
                                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                                        loading="lazy"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-900">
                                            {candidate.name}
                                        </p>
                                        {candidate.category?.name && (
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                {candidate.category.name}
                                            </p>
                                        )}
                                        {error && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                {error}
                                            </p>
                                        )}
                                    </div>
                                    {!error && (
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs text-gray-500">
                                                Preço final
                                            </p>
                                            <p className="font-semibold text-gray-900">
                                                {formatPrice(price ?? candidate.price_cents)}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
                    <div className="shrink-0 border-b border-gray-100 px-4 py-4 md:px-6">
                        <div className="mb-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
                            >
                                <FontAwesomeIcon icon={icons.faChevronLeft} />
                                Voltar
                            </button>
                        </div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Configurar item
                        </p>
                        <h2 className="mt-1 pr-10 text-xl font-bold text-gray-900">
                            {item.name}
                        </h2>
                        {item.description && (
                            <p className="mt-1 text-sm text-gray-500">
                                {item.description}
                            </p>
                        )}
                        <p className="mt-2 font-semibold text-gray-900">
                            {formatPrice(unitPrice)}
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
                        {loading ? (
                            <div className="flex min-h-48 items-center justify-center">
                                <Loader />
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {eligibleForPizza && (
                                    <section>
                                        <div className="rounded-xl bg-gray-50 p-4">
                                            <p className="font-semibold text-gray-900">
                                                Sabores
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Em quantos sabores você quer dividir?
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Array.from(
                                                    {
                                                        length:
                                                            pizzaSettings.max_flavors,
                                                    },
                                                    (_, index) => index + 1
                                                ).map((count) => (
                                                    <button
                                                        key={count}
                                                        type="button"
                                                        onClick={() => {
                                                            setFlavorCount(count);
                                                            setExtraFlavors(
                                                                (previous) =>
                                                                    previous.slice(
                                                                        0,
                                                                        Math.max(
                                                                            0,
                                                                            count - 1
                                                                        )
                                                                    )
                                                            );
                                                            setPizzaError("");
                                                        }}
                                                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                                            flavorCount === count
                                                                ? "border-brand bg-brand text-white"
                                                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                                                        }`}
                                                    >
                                                        {count}{" "}
                                                        {count === 1
                                                            ? "sabor"
                                                            : "sabores"}
                                                    </button>
                                                ))}
                                            </div>

                                            {flavorCount > 1 && (
                                                <div className="mt-3 text-sm text-gray-600">
                                                    <p>
                                                        {pizzaSettings.pricing_rule ===
                                                        "highest"
                                                            ? "Vale o preço do sabor mais caro."
                                                            : "Vale a média dos preços dos sabores."}
                                                    </p>
                                                    <div className="mt-2 space-y-1">
                                                        {flavors.map(
                                                            (flavor, index) => (
                                                                <div
                                                                    key={
                                                                        flavor.id +
                                                                        "-" +
                                                                        index
                                                                    }
                                                                >
                                                                    1/
                                                                    {
                                                                        flavorCount
                                                                    }{" "}
                                                                    {
                                                                        flavor.name
                                                                    }
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                    {extraFlavors.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setExtraFlavors(
                                                                    (previous) =>
                                                                        previous.slice(
                                                                            0,
                                                                            -1
                                                                        )
                                                                );
                                                                setPizzaError(
                                                                    ""
                                                                );
                                                            }}
                                                            className="mt-2 cursor-pointer text-sm font-medium text-brand hover:underline"
                                                        >
                                                            Remover último sabor
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {pizzaError && (
                                    <p className="text-sm text-red-600">
                                        {pizzaError}
                                    </p>
                                )}
                                {quoteError && (
                                    <p className="text-sm text-red-600">
                                        {quoteError}
                                    </p>
                                )}

                                {subcategories.map((group) => {
                                    const currentSet =
                                        selected[group.id] ||
                                        new Set<string>();
                                    const quantities =
                                        selectedQuantities[group.id] || {};
                                    const quantityGroupCount =
                                        getQuantityGroupCount(quantities);
                                    const quantityLimitReached =
                                        group.max_select > 0 &&
                                        quantityGroupCount >=
                                            group.max_select;
                                    const single =
                                        group.max_select === 1 ||
                                        group.max_select === 0;

                                    return (
                                        <section
                                            key={group.id}
                                            className="overflow-hidden rounded-xl border border-gray-200"
                                        >
                                            <div className="flex items-start justify-between gap-3 bg-gray-50 px-4 py-3">
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {group.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-gray-500">
                                                        {group.max_select > 0
                                                            ? `Escolha até ${group.max_select}`
                                                            : "Escolha o quanto quiser"}
                                                    </p>
                                                </div>
                                                {group.min_select > 0 && (
                                                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-600">
                                                        OBRIGATÓRIO
                                                    </span>
                                                )}
                                            </div>

                                            <div className="divide-y divide-gray-100">
                                                {[...group.subitems]
                                                    .sort(
                                                        (first, second) =>
                                                            (first.position ??
                                                                0) -
                                                            (second.position ??
                                                                0)
                                                    )
                                                    .map((subitem) => {
                                                        if (
                                                            group.allow_multiple_units
                                                        ) {
                                                            const quantity =
                                                                quantities[
                                                                    subitem.id
                                                                ] || 0;

                                                            return (
                                                                <div
                                                                    key={
                                                                        subitem.id
                                                                    }
                                                                    className="flex items-center justify-between gap-4 px-4 py-3"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900">
                                                                            {
                                                                                subitem.name
                                                                            }
                                                                        </p>
                                                                        {subitem.price_cents >
                                                                            0 && (
                                                                            <p className="mt-0.5 text-xs text-gray-500">
                                                                                +{" "}
                                                                                {formatPrice(
                                                                                    subitem.price_cents
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={
                                                                                quantity ===
                                                                                0
                                                                            }
                                                                            onClick={() =>
                                                                                changeSubitemQuantity(
                                                                                    group,
                                                                                    subitem,
                                                                                    -1
                                                                                )
                                                                            }
                                                                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
                                                                        >
                                                                            <FontAwesomeIcon
                                                                                icon={
                                                                                    icons.faMinus
                                                                                }
                                                                            />
                                                                        </button>
                                                                        <span className="min-w-5 text-center text-sm font-semibold">
                                                                            {
                                                                                quantity
                                                                            }
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            disabled={
                                                                                quantityLimitReached
                                                                            }
                                                                            onClick={() =>
                                                                                changeSubitemQuantity(
                                                                                    group,
                                                                                    subitem,
                                                                                    1
                                                                                )
                                                                            }
                                                                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-brand hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
                                                                        >
                                                                            <FontAwesomeIcon
                                                                                icon={
                                                                                    icons.faPlus
                                                                                }
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        const isSelected =
                                                            currentSet.has(
                                                                subitem.id
                                                            );

                                                        return (
                                                            <button
                                                                key={subitem.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleSubitem(
                                                                        group,
                                                                        subitem
                                                                    )
                                                                }
                                                                className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-gray-50"
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-900">
                                                                        {
                                                                            subitem.name
                                                                        }
                                                                    </p>
                                                                    {subitem.price_cents >
                                                                        0 && (
                                                                        <p className="mt-0.5 text-xs text-gray-500">
                                                                            +{" "}
                                                                            {formatPrice(
                                                                                subitem.price_cents
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span
                                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                                                                        isSelected
                                                                            ? "border-brand bg-brand text-white"
                                                                            : "border-gray-300 bg-gray-100 text-gray-400"
                                                                    }`}
                                                                >
                                                                    {single ? (
                                                                        <FontAwesomeIcon
                                                                            icon={
                                                                                icons.faCheck
                                                                            }
                                                                            className="text-xs"
                                                                        />
                                                                    ) : isSelected ? (
                                                                        "–"
                                                                    ) : (
                                                                        "+"
                                                                    )}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </section>
                                    );
                                })}

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-gray-800">
                                        Observação
                                    </label>
                                    <Textarea
                                        value={observation}
                                        onChange={(event) =>
                                            setObservation(
                                                event.target.value.slice(0, 140)
                                            )
                                        }
                                        rows={3}
                                        placeholder="Ex: tirar cebola..."
                                        className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                                    />
                                </div>

                                {missingRequired && (
                                    <p className="text-sm font-medium text-warning">
                                        Preencha as opções obrigatórias.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 md:px-6">
                        <div className="flex items-center gap-3">
                            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 p-1 md:ml-auto">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQty((current) =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                                >
                                    <FontAwesomeIcon icon={icons.faMinus} />
                                </button>
                                <span className="min-w-6 text-center font-semibold">
                                    {qty}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQty((current) =>
                                            Math.min(99, current + 1)
                                        )
                                    }
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-brand hover:bg-gray-100"
                                >
                                    <FontAwesomeIcon icon={icons.faPlus} />
                                </button>
                            </div>

                            <Button
                                type="button"
                                onClick={handlePrimaryAction}
                                disabled={
                                    loading ||
                                    missingRequired ||
                                    Boolean(quoteError) ||
                                    Boolean(pizzaError)
                                }
                                loading={loadingFlavors}
                                className="min-w-0 flex-1 md:w-64 md:flex-none"
                            >
                                <span className="flex w-full items-center justify-between gap-3">
                                    <span>
                                        {needsNextFlavor
                                            ? "Próximo sabor"
                                            : "Adicionar"}
                                    </span>
                                    <span>{formatPrice(total)}</span>
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
    );
}

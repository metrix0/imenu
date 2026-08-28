"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faEdit,
    faLayerGroup,
    faSearch,
    faTrash,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Input from "@/components/ui/Input";
import ListLoader from "@/components/ui/ListLoader";
import Toast from "@/components/ui/Toast";
import ManageComplementGroupModal, {
    type SharedComplementAvailability,
    type SharedComplementGroup,
    type SharedComplementOption,
} from "@/components/restaurant-owner/cardapio/ManageComplementGroupModal";
import { supabase } from "@/lib/database/supabaseClient";

type RestaurantItem = {
    id: string;
    name: string;
};

type ComplementGroupRow = {
    id: string;
    item_id: string;
    name: string;
    description: string | null;
    min_select: number;
    max_select: number;
    allow_multiple_units: boolean;
    position: number;
    created_at: string;
};

type ComplementOptionRow = {
    id: string;
    item_subcategory_id: string;
    name: string;
    description: string | null;
    price_cents: number;
    is_available: boolean;
    position: number;
};

interface ComplementosTabProps {
    restaurantId: string;
}

const normalizeText = (value: string | null) =>
    (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("pt-BR");

const sortOptions = (options: ComplementOptionRow[]) =>
    [...options].sort(
        (first, second) =>
            first.position - second.position ||
            first.id.localeCompare(second.id)
    );

const getGroupSignature = (
    group: ComplementGroupRow,
    options: ComplementOptionRow[]
) =>
    JSON.stringify({
        name: normalizeText(group.name),
        description: normalizeText(group.description),
        minSelect: group.min_select,
        maxSelect: group.max_select,
        allowMultipleUnits: group.allow_multiple_units === true,
        options: options.map((option) => [
            normalizeText(option.name),
            normalizeText(option.description),
            option.price_cents,
        ]),
    });

const getAvailability = (
    options: ComplementOptionRow[]
): SharedComplementAvailability => {
    const availableCount = options.filter(
        (option) => option.is_available
    ).length;

    if (availableCount === options.length) return "available";
    if (availableCount === 0) return "paused";
    return "mixed";
};

const buildSharedGroups = (
    items: RestaurantItem[],
    groupRows: ComplementGroupRow[],
    optionRows: ComplementOptionRow[]
) => {
    const itemNames = new Map(items.map((item) => [item.id, item.name]));
    const optionsByGroup = new Map<string, ComplementOptionRow[]>();

    for (const option of optionRows) {
        const currentOptions =
            optionsByGroup.get(option.item_subcategory_id) || [];
        currentOptions.push(option);
        optionsByGroup.set(option.item_subcategory_id, currentOptions);
    }

    for (const [groupId, options] of optionsByGroup) {
        optionsByGroup.set(groupId, sortOptions(options));
    }

    const clustersBySignature = new Map<string, ComplementGroupRow[][]>();

    for (const group of groupRows) {
        const signature = getGroupSignature(
            group,
            optionsByGroup.get(group.id) || []
        );
        const clusters = clustersBySignature.get(signature) || [];
        const compatibleCluster = clusters.find(
            (cluster) =>
                !cluster.some(
                    (currentGroup) => currentGroup.item_id === group.item_id
                )
        );

        if (compatibleCluster) {
            compatibleCluster.push(group);
        } else {
            clusters.push([group]);
        }

        clustersBySignature.set(signature, clusters);
    }

    const sharedGroups: SharedComplementGroup[] = [];

    for (const clusters of clustersBySignature.values()) {
        for (const cluster of clusters) {
            const firstGroup = cluster[0];
            const firstOptions = optionsByGroup.get(firstGroup.id) || [];
            const itemIds = cluster.map((group) => group.item_id);
            const uniqueItemNames = Array.from(
                new Set(
                    itemIds.map(
                        (itemId) =>
                            itemNames.get(itemId) || "Produto desconhecido"
                    )
                )
            ).sort((first, second) =>
                first.localeCompare(second, "pt-BR")
            );

            const options: SharedComplementOption[] = firstOptions.map(
                (firstOption, optionIndex) => {
                    const matchingOptions = cluster
                        .map(
                            (group) =>
                                (optionsByGroup.get(group.id) || [])[optionIndex]
                        )
                        .filter(
                            (option): option is ComplementOptionRow => !!option
                        );

                    return {
                        id: firstOption.id,
                        ids: matchingOptions.map((option) => option.id),
                        name: firstOption.name,
                        description: firstOption.description,
                        price_cents: firstOption.price_cents,
                        position: firstOption.position,
                        availability: getAvailability(matchingOptions),
                    };
                }
            );

            sharedGroups.push({
                id: firstGroup.id,
                ids: cluster.map((group) => group.id),
                itemIds,
                itemNames: uniqueItemNames,
                name: firstGroup.name,
                description: firstGroup.description,
                min_select: firstGroup.min_select,
                max_select: firstGroup.max_select,
                allow_multiple_units: firstGroup.allow_multiple_units === true,
                options,
            });
        }
    }

    return sharedGroups;
};

export default function ComplementosTab({
    restaurantId,
}: ComplementosTabProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [groups, setGroups] = useState<SharedComplementGroup[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [groupToEdit, setGroupToEdit] =
        useState<SharedComplementGroup | null>(null);
    const [groupToDelete, setGroupToDelete] =
        useState<SharedComplementGroup | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{
        id: number;
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const fetchGroups = async () => {
        setIsLoading(true);

        try {
            const { data: itemRows, error: itemsError } = await supabase
                .from("items")
                .select("id, name")
                .eq("restaurant_id", restaurantId);

            if (itemsError) throw itemsError;

            const items = (itemRows || []) as RestaurantItem[];
            const itemIds = items.map((item) => item.id);

            if (itemIds.length === 0) {
                setGroups([]);
                return;
            }

            const { data: groupRows, error: groupsError } = await supabase
                .from("item_subcategories")
                .select(
                    "id, item_id, name, description, min_select, max_select, allow_multiple_units, position, created_at"
                )
                .in("item_id", itemIds)
                .order("created_at", { ascending: false });

            if (groupsError) throw groupsError;

            const complementGroups =
                (groupRows || []) as ComplementGroupRow[];
            const groupIds = complementGroups.map((group) => group.id);

            if (groupIds.length === 0) {
                setGroups([]);
                return;
            }

            const { data: optionRows, error: optionsError } = await supabase
                .from("subitems")
                .select(
                    "id, item_subcategory_id, name, description, price_cents, is_available, position"
                )
                .in("item_subcategory_id", groupIds)
                .order("position", { ascending: true });

            if (optionsError) throw optionsError;

            setGroups(
                buildSharedGroups(
                    items,
                    complementGroups,
                    (optionRows || []) as ComplementOptionRow[]
                )
            );
        } catch (error) {
            console.error("Erro ao buscar complementos:", error);
            setToast({
                id: Date.now(),
                message: "Não foi possível carregar os complementos.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) void fetchGroups();
    }, [restaurantId]);

    const normalizedSearch = normalizeText(searchTerm);
    const filteredGroups = groups.filter(
        (group) =>
            normalizeText(group.name).includes(normalizedSearch) ||
            group.itemNames.some((itemName) =>
                normalizeText(itemName).includes(normalizedSearch)
            )
    );

    const handleGroupChange = (updatedGroup: SharedComplementGroup) => {
        setGroups((currentGroups) =>
            currentGroups.map((group) =>
                group.id === updatedGroup.id ? updatedGroup : group
            )
        );
        setGroupToEdit(updatedGroup);
    };

    const handleDeleteGroup = async () => {
        if (!groupToDelete) return;

        setIsDeleting(true);
        const { error } = await supabase
            .from("item_subcategories")
            .delete()
            .in("id", groupToDelete.ids);

        if (error) {
            console.error("Erro ao excluir grupo de complementos:", error);
            setToast({
                id: Date.now(),
                message: "Não foi possível excluir o grupo.",
                type: "error",
            });
        } else {
            setGroups((currentGroups) =>
                currentGroups.filter(
                    (group) => group.id !== groupToDelete.id
                )
            );
            setToast({
                id: Date.now(),
                message:
                    groupToDelete.itemIds.length > 1
                        ? `Grupo removido de ${groupToDelete.itemIds.length} produtos.`
                        : "Grupo removido.",
                type: "success",
            });
            setGroupToDelete(null);
        }

        setIsDeleting(false);
    };

    if (isLoading) {
        return (
            <div className="py-10">
                <ListLoader lines={5} />
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-white py-20 shadow-sm">
                <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-full bg-gray-50">
                    <FontAwesomeIcon
                        icon={faLayerGroup}
                        className="text-5xl text-gray-300"
                    />
                </div>
                <h3 className="mb-2 text-center text-lg font-bold text-gray-900">
                    Nenhum grupo de complementos encontrado
                </h3>
                <p className="mx-4 mb-8 max-w-md text-center text-sm text-gray-500">
                    Para criar complementos (como &quot;Escolha o
                    Molho&quot;), vá na aba <strong>Produtos</strong>, clique em
                    &quot;Opções&quot; de um item e adicione lá.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 md:flex-row">
                <div className="w-full flex-1">
                    <Input
                        placeholder="Buscar grupo ou produto..."
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {filteredGroups.map((group) => {
                    const productsCount = group.itemIds.length;
                    const productsPreview = group.itemNames
                        .slice(0, 3)
                        .join(", ");
                    const remainingProducts = Math.max(
                        0,
                        productsCount - 3
                    );

                    return (
                        <div
                            key={group.id}
                            className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand/30 sm:flex-row sm:items-center 2xl:p-6"
                        >
                            <div className="mb-3 min-w-0 sm:mb-0 sm:pr-6">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-lg font-bold text-gray-900">
                                        {group.name}
                                    </h4>
                                    {productsCount > 1 && (
                                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand 2xl:text-sm">
                                            {productsCount} produtos
                                        </span>
                                    )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 2xl:mt-2 2xl:text-base">
                                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 2xl:text-sm">
                                        {group.min_select > 0
                                            ? "Obrigatório"
                                            : "Opcional"}
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {group.options.length}{" "}
                                        {group.options.length === 1
                                            ? "opção"
                                            : "opções"}
                                    </span>
                                    <span>•</span>
                                    <span
                                        className="min-w-0 truncate"
                                        title={group.itemNames.join(", ")}
                                    >
                                        <FontAwesomeIcon
                                            icon={faUtensils}
                                            className="mr-1 text-xs 2xl:text-base"
                                        />
                                        {productsPreview}
                                        {remainingProducts > 0
                                            ? ` +${remainingProducts}`
                                            : ""}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto 2xl:gap-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => setGroupToEdit(group)}
                                    className="h-8 px-3 text-xs 2xl:h-10"
                                >
                                    <FontAwesomeIcon
                                        icon={faEdit}
                                        className="mr-2"
                                    />
                                    Editar
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setGroupToDelete(group)}
                                    title="Excluir grupo"
                                    aria-label={`Excluir ${group.name}`}
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center text-gray-400 transition-all hover:text-red-600 2xl:text-xl"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredGroups.length === 0 && searchTerm && (
                    <p className="py-10 text-center text-gray-500">
                        Nenhum grupo encontrado para &quot;{searchTerm}&quot;
                    </p>
                )}
            </div>

            <ManageComplementGroupModal
                open={!!groupToEdit}
                group={groupToEdit}
                onClose={() => setGroupToEdit(null)}
                onGroupChange={handleGroupChange}
            />

            <ConfirmModal
                open={!!groupToDelete}
                onClose={() => {
                    if (!isDeleting) setGroupToDelete(null);
                }}
                onConfirm={() => void handleDeleteGroup()}
                title="Apagar grupo"
                description={
                    groupToDelete
                        ? groupToDelete.itemIds.length > 1
                            ? `Este grupo e todas as opções serão removidos dos ${groupToDelete.itemIds.length} produtos em que são usados.`
                            : "Este grupo e todas as opções serão removidos do produto."
                        : undefined
                }
                confirmLabel="Apagar"
                isLoading={isDeleting}
                variant="danger"
            />

            {toast && (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faGripVertical,
    faPlus,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { supabase } from "@/lib/database/supabaseClient";
import { icons } from "@/lib/utils/fontawesome";

export type SharedComplementAvailability =
    | "available"
    | "paused"
    | "mixed";

export type SharedComplementOption = {
    id: string;
    ids: string[];
    name: string;
    description: string | null;
    price_cents: number;
    position: number;
    availability: SharedComplementAvailability;
};

export type SharedComplementGroup = {
    id: string;
    ids: string[];
    itemIds: string[];
    itemNames: string[];
    name: string;
    description: string | null;
    min_select: number;
    max_select: number;
    allow_multiple_units: boolean;
    options: SharedComplementOption[];
};

interface ManageComplementGroupModalProps {
    open: boolean;
    group: SharedComplementGroup | null;
    onClose: () => void;
    onGroupChange: (group: SharedComplementGroup) => void;
}

const cloneGroup = (group: SharedComplementGroup): SharedComplementGroup => ({
    ...group,
    ids: [...group.ids],
    itemIds: [...group.itemIds],
    itemNames: [...group.itemNames],
    options: group.options.map((option) => ({
        ...option,
        ids: [...option.ids],
    })),
});

const formatPriceInput = (cents: number) =>
    (Math.max(0, cents) / 100).toFixed(2).replace(".", ",");

const sanitizePriceInput = (value: string) => {
    const cleaned = value.replace(/[^\d,.]/g, "");
    const separatorIndex = Math.max(
        cleaned.lastIndexOf(","),
        cleaned.lastIndexOf(".")
    );

    if (separatorIndex === -1) {
        return cleaned.replace(/\D/g, "").slice(0, 9);
    }

    const integerPart = cleaned
        .slice(0, separatorIndex)
        .replace(/\D/g, "")
        .slice(0, 9);
    const decimals = cleaned
        .slice(separatorIndex + 1)
        .replace(/\D/g, "")
        .slice(0, 2);

    return `${integerPart},${decimals}`;
};

function ComplementPriceInput({
    priceCents,
    disabled,
    onSave,
}: {
    priceCents: number;
    disabled: boolean;
    onSave: (priceCents: number) => Promise<void>;
}) {
    const [localValue, setLocalValue] = useState(
        formatPriceInput(priceCents)
    );

    useEffect(() => {
        setLocalValue(formatPriceInput(priceCents));
    }, [priceCents]);

    const handleBlur = () => {
        const parsed = Number.parseFloat(localValue.replace(",", "."));
        const nextCents =
            Number.isFinite(parsed) && parsed >= 0
                ? Math.round(parsed * 100)
                : priceCents;

        setLocalValue(formatPriceInput(nextCents));
        if (nextCents !== priceCents) void onSave(nextCents);
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={localValue}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
                setLocalValue(sanitizePriceInput(event.target.value))
            }
            onBlur={handleBlur}
            onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="w-full rounded border border-gray-200 py-1 pl-6 pr-1 text-right text-sm text-gray-700 focus:border-brand focus:outline-none disabled:opacity-60 2xl:text-base"
        />
    );
}

export default function ManageComplementGroupModal({
    open,
    group,
    onClose,
    onGroupChange,
}: ManageComplementGroupModalProps) {
    const [draft, setDraft] = useState<SharedComplementGroup | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allowDragId, setAllowDragId] = useState<string | null>(null);
    const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
    const [optionToPause, setOptionToPause] = useState<string | null>(null);
    const [toast, setToast] = useState<{
        id: number;
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);
    const savedGroupRef = useRef<SharedComplementGroup | null>(null);

    useEffect(() => {
        setOptionToPause(null);

        if (!open || !group) {
            setDraft(null);
            savedGroupRef.current = null;
            return;
        }

        const nextGroup = cloneGroup(group);
        setDraft(nextGroup);
        savedGroupRef.current = cloneGroup(nextGroup);
    }, [open, group?.id]);

    const showError = (message: string) => {
        setToast({
            id: Date.now(),
            message,
            type: "error",
        });
    };

    const commitGroup = (nextGroup: SharedComplementGroup) => {
        const committedGroup = cloneGroup(nextGroup);
        savedGroupRef.current = cloneGroup(committedGroup);
        setDraft(committedGroup);
        onGroupChange(committedGroup);
    };

    const restoreSavedGroup = () => {
        if (savedGroupRef.current) {
            setDraft(cloneGroup(savedGroupRef.current));
        }
    };

    const updateGroup = async (
        updates: Partial<
            Pick<
                SharedComplementGroup,
                "name" | "min_select" | "max_select" | "allow_multiple_units"
            >
        >
    ) => {
        if (!draft) return;

        setIsSaving(true);
        const { error } = await supabase
            .from("item_subcategories")
            .update(updates)
            .in("id", draft.ids);

        if (error) {
            console.error("Erro ao atualizar grupo de complementos:", error);
            restoreSavedGroup();
            showError("Não foi possível salvar o grupo.");
        } else {
            commitGroup({ ...draft, ...updates });
        }

        setIsSaving(false);
    };

    const updateOption = async (
        optionId: string,
        updates: Partial<
            Pick<SharedComplementOption, "name" | "price_cents">
        >
    ) => {
        if (!draft) return;

        const option = draft.options.find(
            (currentOption) => currentOption.id === optionId
        );
        if (!option) return;

        setIsSaving(true);
        const { error } = await supabase
            .from("subitems")
            .update(updates)
            .in("id", option.ids);

        if (error) {
            console.error("Erro ao atualizar opção de complemento:", error);
            restoreSavedGroup();
            showError("Não foi possível salvar a opção.");
        } else {
            commitGroup({
                ...draft,
                options: draft.options.map((currentOption) =>
                    currentOption.id === optionId
                        ? { ...currentOption, ...updates }
                        : currentOption
                ),
            });
        }

        setIsSaving(false);
    };

    const setOptionAvailability = async (
        optionId: string,
        isAvailable: boolean
    ) => {
        if (!draft) return;

        const option = draft.options.find(
            (currentOption) => currentOption.id === optionId
        );
        if (!option) return;

        setIsSaving(true);

        const { data, error } = await supabase
            .from("subitems")
            .update({ is_available: isAvailable })
            .in("id", option.ids)
            .select("id, is_available");

        const updatedEveryCopy =
            !error &&
            !!data &&
            data.length === option.ids.length &&
            data.every((row) => row.is_available === isAvailable);

        if (!updatedEveryCopy) {
            console.error("Erro ao alterar disponibilidade de complemento:", error);
            showError("Não foi possível alterar a disponibilidade.");
        } else {
            commitGroup({
                ...draft,
                options: draft.options.map((currentOption) =>
                    currentOption.id === optionId
                        ? {
                              ...currentOption,
                              availability: isAvailable
                                  ? "available"
                                  : "paused",
                          }
                        : currentOption
                ),
            });
        }

        setIsSaving(false);
    };

    const toggleOptionAvailability = async (optionId: string) => {
        if (!draft) return;

        const option = draft.options.find(
            (currentOption) => currentOption.id === optionId
        );
        if (!option) return;

        const isAvailable = option.availability !== "available";
        const pausesLastAvailableOption =
            !isAvailable &&
            draft.min_select > 0 &&
            draft.options
                .filter((currentOption) => currentOption.id !== optionId)
                .every(
                    (currentOption) => currentOption.availability === "paused"
                );

        if (pausesLastAvailableOption) {
            setOptionToPause(optionId);
            return;
        }

        await setOptionAvailability(optionId, isAvailable);
    };

    const confirmPauseLastOption = async () => {
        if (!optionToPause) return;

        const optionId = optionToPause;
        setOptionToPause(null);
        await setOptionAvailability(optionId, false);
    };

    const addOption = async () => {
        if (!draft) return;

        const nextPosition = draft.options.length
            ? Math.max(...draft.options.map((option) => option.position)) + 1
            : 0;
        const rows = draft.ids.map((groupId) => ({
            item_subcategory_id: groupId,
            name: "Nova Opção",
            description: null,
            price_cents: 0,
            is_available: true,
            position: nextPosition,
        }));

        setIsSaving(true);
        const { data, error } = await supabase
            .from("subitems")
            .insert(rows)
            .select(
                "id, item_subcategory_id, name, description, price_cents, is_available, position"
            );

        if (error || !data || data.length !== rows.length) {
            console.error("Erro ao adicionar opção de complemento:", error);
            showError("Não foi possível adicionar a opção.");
        } else {
            const newOption: SharedComplementOption = {
                id: data[0].id,
                ids: data.map((row) => row.id),
                name: data[0].name,
                description: data[0].description,
                price_cents: data[0].price_cents,
                position: data[0].position,
                availability: "available",
            };

            commitGroup({
                ...draft,
                options: [...draft.options, newOption],
            });
        }

        setIsSaving(false);
    };

    const deleteOption = async (optionId: string) => {
        if (!draft) return;

        const option = draft.options.find(
            (currentOption) => currentOption.id === optionId
        );
        if (!option) return;

        setIsSaving(true);
        const { error } = await supabase
            .from("subitems")
            .delete()
            .in("id", option.ids);

        if (error) {
            console.error("Erro ao excluir opção de complemento:", error);
            showError("Não foi possível excluir a opção.");
        } else {
            commitGroup({
                ...draft,
                options: draft.options.filter(
                    (currentOption) => currentOption.id !== optionId
                ),
            });
        }

        setIsSaving(false);
    };

    const handleOptionDragStart = (
        event: DragEvent,
        optionId: string
    ) => {
        setDraggedOptionId(optionId);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleOptionDragOver = (
        event: DragEvent,
        targetOptionId: string
    ) => {
        event.preventDefault();
        if (!draft || !draggedOptionId || draggedOptionId === targetOptionId) {
            return;
        }

        const options = [...draft.options];
        const fromIndex = options.findIndex(
            (option) => option.id === draggedOptionId
        );
        const toIndex = options.findIndex(
            (option) => option.id === targetOptionId
        );

        if (fromIndex === -1 || toIndex === -1) return;

        const [movedOption] = options.splice(fromIndex, 1);
        options.splice(toIndex, 0, movedOption);
        setDraft({ ...draft, options });
    };

    const handleOptionDragEnd = async () => {
        if (!draft || !draggedOptionId) return;

        setDraggedOptionId(null);
        setAllowDragId(null);
        setIsSaving(true);

        const reorderedOptions = draft.options.map((option, position) => ({
            ...option,
            position,
        }));
        const results = await Promise.all(
            reorderedOptions.map((option) =>
                supabase
                    .from("subitems")
                    .update({ position: option.position })
                    .in("id", option.ids)
            )
        );
        const error = results.find((result) => result.error)?.error;

        if (error) {
            console.error("Erro ao reordenar opções de complemento:", error);
            restoreSavedGroup();
            showError("Não foi possível reordenar as opções.");
        } else {
            commitGroup({ ...draft, options: reorderedOptions });
        }

        setIsSaving(false);
    };

    const handleClose = () => {
        if (!isSaving) onClose();
    };

    if (!draft) return null;

    const productLabel =
        draft.itemIds.length === 1
            ? `Produto: ${draft.itemNames[0]}`
            : `Editando em ${draft.itemIds.length} produtos`;

    return (
        <>
            <Modal open={open} onClose={handleClose}>
                <div className="flex max-h-[85vh] w-full flex-col rounded-lg bg-white">
                    <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-6">
                        <div className="min-w-0 pr-4">
                            <h2 className="text-xl font-bold text-gray-900 2xl:text-2xl">
                                Editar complemento
                            </h2>
                            <p
                                className="mt-1 truncate text-sm text-gray-500 2xl:text-base"
                                title={draft.itemNames.join(", ")}
                            >
                                {productLabel}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
                            aria-label="Fechar"
                            className="cursor-pointer text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FontAwesomeIcon
                                icon={icons.faTimes}
                                className="text-xl"
                            />
                        </button>
                    </div>

                    <div className="flex-1 space-y-5 overflow-y-auto p-6">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <input
                                value={draft.name}
                                disabled={isSaving}
                                onChange={(event) =>
                                    setDraft({
                                        ...draft,
                                        name: event.target.value,
                                    })
                                }
                                onBlur={(event) => {
                                    const name = event.currentTarget.value.trim();
                                    if (!name) {
                                        restoreSavedGroup();
                                        return;
                                    }
                                    if (name !== savedGroupRef.current?.name) {
                                        void updateGroup({ name });
                                    }
                                }}
                                className="w-full bg-transparent text-lg font-bold text-gray-800 focus:border-b focus:border-brand focus:outline-none disabled:opacity-60 2xl:text-xl"
                            />

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 2xl:text-base">
                                <label className="flex cursor-pointer select-none items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={draft.min_select > 0}
                                        disabled={isSaving}
                                        onChange={(event) => {
                                            const min_select = event.target.checked
                                                ? 1
                                                : 0;
                                            setDraft({
                                                ...draft,
                                                min_select,
                                            });
                                            void updateGroup({ min_select });
                                        }}
                                        className="rounded text-brand focus:ring-brand"
                                    />
                                    Obrigatório
                                </label>

                                <div className="flex items-center gap-2">
                                    <span>Até:</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={draft.max_select}
                                        disabled={isSaving}
                                        onChange={(event) =>
                                            setDraft({
                                                ...draft,
                                                max_select: Math.max(
                                                    1,
                                                    Number.parseInt(
                                                        event.target.value,
                                                        10
                                                    ) || 1
                                                ),
                                            })
                                        }
                                        onBlur={(event) => {
                                            const max_select = Math.max(
                                                1,
                                                Number.parseInt(
                                                    event.currentTarget.value,
                                                    10
                                                ) || 1
                                            );
                                            if (
                                                max_select !==
                                                savedGroupRef.current?.max_select
                                            ) {
                                                void updateGroup({ max_select });
                                            }
                                        }}
                                        className="w-14 rounded border border-gray-300 p-1 text-center text-sm disabled:opacity-60 2xl:text-base"
                                    />
                                </div>

                                <div className="flex basis-full min-w-0 items-center gap-2 sm:basis-auto">
                                    <input
                                        type="checkbox"
                                        aria-label="Mais de uma unidade por complemento"
                                        checked={draft.allow_multiple_units === true}
                                        disabled={isSaving}
                                        onChange={(event) => {
                                            const allow_multiple_units =
                                                event.target.checked;
                                            setDraft({
                                                ...draft,
                                                allow_multiple_units,
                                            });
                                            void updateGroup({
                                                allow_multiple_units,
                                            });
                                        }}
                                        className="shrink-0 rounded text-brand focus:ring-brand"
                                    />
                                    <Tooltip
                                        text="Mais de uma unidade por complemento"
                                        showOnClick
                                        position="top"
                                        parentClassName="min-w-0 max-w-full overflow-hidden sm:max-w-none sm:overflow-visible"
                                    >
                                        <span className="block max-w-full cursor-help truncate">
                                            Mais de uma unidade por complemento
                                        </span>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {draft.options.map((option) => {
                                const isAvailable =
                                    option.availability === "available";

                                return (
                                    <div
                                        key={option.id}
                                        draggable={
                                            !isSaving && allowDragId === option.id
                                        }
                                        onDragStart={(event) =>
                                            handleOptionDragStart(
                                                event,
                                                option.id
                                            )
                                        }
                                        onDragOver={(event) =>
                                            handleOptionDragOver(
                                                event,
                                                option.id
                                            )
                                        }
                                        onDragEnd={() =>
                                            void handleOptionDragEnd()
                                        }
                                        className={`flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-opacity sm:flex-nowrap ${
                                            draggedOptionId === option.id
                                                ? "opacity-50"
                                                : "opacity-100"
                                        } ${
                                            isAvailable
                                                ? "border-gray-100"
                                                : "border-gray-200 bg-gray-50"
                                        }`}
                                    >
                                        <div
                                            onMouseEnter={() =>
                                                setAllowDragId(option.id)
                                            }
                                            onMouseLeave={() =>
                                                setAllowDragId(null)
                                            }
                                            onTouchStart={() =>
                                                setAllowDragId(option.id)
                                            }
                                            className="cursor-grab p-1 text-gray-300 active:cursor-grabbing"
                                        >
                                            <FontAwesomeIcon
                                                icon={faGripVertical}
                                                className="text-xs 2xl:text-base"
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <input
                                                    value={option.name}
                                                    disabled={isSaving}
                                                    onChange={(event) =>
                                                        setDraft({
                                                            ...draft,
                                                            options:
                                                                draft.options.map(
                                                                    (
                                                                        currentOption
                                                                    ) =>
                                                                        currentOption.id ===
                                                                        option.id
                                                                            ? {
                                                                                  ...currentOption,
                                                                                  name: event
                                                                                      .target
                                                                                      .value,
                                                                              }
                                                                            : currentOption
                                                                ),
                                                        })
                                                    }
                                                    onBlur={(event) => {
                                                        const name =
                                                            event.currentTarget.value.trim();
                                                        if (!name) {
                                                            restoreSavedGroup();
                                                            return;
                                                        }

                                                        const savedOption =
                                                            savedGroupRef.current?.options.find(
                                                                (
                                                                    currentOption
                                                                ) =>
                                                                    currentOption.id ===
                                                                    option.id
                                                            );
                                                        if (
                                                            name !==
                                                            savedOption?.name
                                                        ) {
                                                            void updateOption(
                                                                option.id,
                                                                { name }
                                                            );
                                                        }
                                                    }}
                                                    className="min-w-0 flex-1 truncate bg-transparent text-sm text-gray-700 focus:outline-none disabled:opacity-60 2xl:text-base"
                                                />

                                                {option.availability ===
                                                    "paused" && (
                                                    <span className="shrink-0 text-[10px] font-bold uppercase text-red-500">
                                                        Pausada
                                                    </span>
                                                )}
                                                {option.availability ===
                                                    "mixed" && (
                                                    <span className="shrink-0 text-[10px] font-bold uppercase text-amber-600">
                                                        Parcial
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="ml-auto flex w-full items-center justify-end gap-3 pl-8 sm:w-auto sm:pl-0">
                                            <div className="relative flex w-24 shrink-0 items-center gap-1 sm:w-28 2xl:w-28">
                                                <span className="absolute left-2 text-xs text-gray-400 2xl:text-base">
                                                    R$
                                                </span>
                                                <ComplementPriceInput
                                                    priceCents={
                                                        option.price_cents
                                                    }
                                                    disabled={isSaving}
                                                    onSave={(price_cents) =>
                                                        updateOption(option.id, {
                                                            price_cents,
                                                        })
                                                    }
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                role="switch"
                                                disabled={isSaving}
                                                onClick={() =>
                                                    void toggleOptionAvailability(
                                                        option.id
                                                    )
                                                }
                                                title={
                                                    isAvailable
                                                        ? "Pausar opção"
                                                        : "Ativar opção em todos os produtos"
                                                }
                                                aria-label={
                                                    isAvailable
                                                        ? `Pausar ${option.name}`
                                                        : `Ativar ${option.name}`
                                                }
                                                aria-checked={
                                                    option.availability ===
                                                    "mixed"
                                                        ? "mixed"
                                                        : isAvailable
                                                }
                                                className={`flex h-6 w-10 cursor-pointer items-center rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 2xl:h-8 2xl:w-15 ${
                                                    isAvailable
                                                        ? "justify-end bg-green-500"
                                                        : option.availability ===
                                                            "mixed"
                                                          ? "justify-center bg-amber-400"
                                                          : "justify-start bg-gray-300"
                                                }`}
                                            >
                                                <span className="h-4 w-4 rounded-full bg-white shadow-md 2xl:h-6 2xl:w-6" />
                                            </button>

                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() =>
                                                    void deleteOption(option.id)
                                                }
                                                title="Excluir opção"
                                                aria-label={`Excluir ${option.name}`}
                                                className="flex h-7 w-7 cursor-pointer items-center justify-center text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <FontAwesomeIcon
                                                    icon={faTrash}
                                                    className="text-xs 2xl:text-lg"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => void addOption()}
                                disabled={isSaving}
                                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-brand/20 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50 2xl:text-base"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                Adicionar opção
                            </button>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-6">
                        {isSaving && (
                            <span className="text-sm text-gray-400">
                                Salvando...
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-md bg-brand px-6 py-2 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Concluir
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                open={!!optionToPause}
                onClose={() => {
                    if (!isSaving) setOptionToPause(null);
                }}
                onConfirm={() => void confirmPauseLastOption()}
                title="Pausar última opção"
                description="Este complemento é obrigatório. Se todas as opções forem pausadas, os clientes não conseguirão adicionar os produtos ao pedido."
                confirmLabel="Pausar mesmo assim"
                isLoading={isSaving}
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
        </>
    );
}

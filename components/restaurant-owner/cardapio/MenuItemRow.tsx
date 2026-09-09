"use client";

import Switch from "@/components/ui/Switch";
import Input from "@/components/ui/Input";
import { useState, useRef, useEffect, ReactNode } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faImage,
    faLayerGroup,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import { uploadMenuImage } from "@/lib/database/uploadMenuImage";
import { supabase } from "@/lib/database/supabaseClient";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Toast from "@/components/ui/Toast";

export type MenuItemType = {
    id: string;
    name: string;
    price_cents: number;
    description?: string | null;
    image_url?: string | null;
    image_path?: string | null;
    is_available: boolean;
    category_id: string;
    position?: number;
    stock_enabled?: boolean | null;
    stock_quantity?: number | null;
};

interface MenuItemRowProps {
    item: MenuItemType;
    isNew?: boolean;
    onSave: (item: MenuItemType) => Promise<void>;
    onDelete?: (id: string) => void;
    onDuplicate?: (item: MenuItemType) => void;
    onCancel?: () => void;
    onOpenDetails?: () => void;
    onEditingChange?: (isEditing: boolean) => void;
    dragHandle?: ReactNode;
}

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

const priceInputToCents = (value: string) => {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0
        ? Math.round(parsed * 100)
        : 0;
};

export default function MenuItemRow({
    item,
    isNew = false,
    onSave,
    onDelete,
    onDuplicate,
    onCancel,
    onOpenDetails,
    onEditingChange,
    dragHandle,
}: MenuItemRowProps) {
    const restaurantSlug = useCreationStore((state) => state.restaurantSlug);
    const setRestaurantSlug = useCreationStore(
        (state) => state.setRestaurantSlug
    );
    const restaurantId = useCreationStore((state) => state.restaurantId);

    const [isEditing, setIsEditing] = useState(isNew);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [name, setName] = useState(item.name ?? "");
    const [description, setDescription] = useState(item.description ?? "");
    const [priceCents, setPriceCents] = useState(item.price_cents ?? 0);
    const [priceInput, setPriceInput] = useState(
        formatPriceInput(item.price_cents ?? 0)
    );
    const [stockInput, setStockInput] = useState(
        String(item.stock_quantity ?? 0)
    );
    const [imageUrl, setImageUrl] = useState(item.image_url ?? null);
    const [imagePath, setImagePath] = useState(item.image_path ?? null);
    const [isAvailable, setIsAvailable] = useState(
        item.is_available ?? false
    );
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type?: "success" | "error" | "info";
    } | null>(null);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCopy = async () => {
        let slug = restaurantSlug;

        if (!slug) {
            const { data, error } = await supabase
                .from("restaurants")
                .select("url_slug")
                .eq("id", restaurantId)
                .single();

            if (error || !data) {
                console.error("Failed to fetch restaurant slug", error);
                return;
            }

            if (setRestaurantSlug) {
                setRestaurantSlug(data.url_slug);
            }

            slug = data.url_slug;
        }

        const couponLink = `imenuapp.com.br/${slug}/?p=${item.id}`;
        await navigator.clipboard.writeText(couponLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        if (isNew && nameInputRef.current) nameInputRef.current.focus();
    }, [isNew]);

    useEffect(() => {
        const nextPrice = item.price_cents ?? 0;
        setPriceCents(nextPrice);
        setPriceInput(formatPriceInput(nextPrice));
    }, [item.price_cents]);

    useEffect(() => {
        setStockInput(String(item.stock_quantity ?? 0));
    }, [item.stock_quantity]);

    const autoSave = async (overrideData?: Partial<MenuItemType>) => {
        if (isNew || !name.trim()) return;

        setIsLoading(true);
        try {
            await onSave({
                ...item,
                name,
                description,
                price_cents: priceCents,
                image_path: imagePath,
                image_url: imageUrl,
                is_available: isAvailable,
                ...overrideData,
            });
        } catch (error) {
            console.error("Erro no auto-save:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePriceBlur = async () => {
        const nextPriceCents = priceInputToCents(priceInput);
        setPriceCents(nextPriceCents);
        setPriceInput(formatPriceInput(nextPriceCents));
        await autoSave({ price_cents: nextPriceCents });
    };

    const handleStockBlur = async () => {
        if (!item.stock_enabled || isNew) return;

        const raw = stockInput.trim();
        const parsed = Number(raw);

        if (
            raw === "" ||
            Number.isNaN(parsed) ||
            parsed < 0 ||
            !Number.isInteger(parsed)
        ) {
            setStockInput(String(item.stock_quantity ?? 0));
            setToast({
                message: "Informe uma quantidade válida.",
                type: "error",
            });
            return;
        }

        setStockInput(String(parsed));
        setIsLoading(true);

        try {
            const { error } = await supabase
                .from("items")
                .update({
                    stock_quantity: parsed,
                    is_available: parsed > 0,
                })
                .eq("id", item.id)
                .eq("restaurant_id", restaurantId);

            if (error) throw error;
            setIsAvailable(parsed > 0);
        } catch (error) {
            console.error("Erro ao salvar estoque:", error);
            setStockInput(String(item.stock_quantity ?? 0));
            setToast({
                message: "Erro ao salvar quantidade.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const path = await uploadMenuImage(file);
            const { data } = supabase.storage
                .from("menu-images")
                .getPublicUrl(path);
            setImagePath(path);
            setImageUrl(data.publicUrl);

            if (!isNew) {
                await autoSave({
                    image_path: path,
                    image_url: data.publicUrl,
                });
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar imagem.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleAvailability = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (item.stock_enabled && Number(stockInput || 0) <= 0) {
            setToast({
                message:
                    "Não é possível ativar um item sem estoque. Ajuste na aba Estoque.",
                type: "error",
            });
            return;
        }

        const newState = !isAvailable;
        setIsAvailable(newState);

        if (!isNew) {
            try {
                const res = await fetch(
                    `/api/items/${String(item.id)}/toggle`,
                    { method: "PATCH" }
                );
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json.error || "Failed to toggle");
                }

                setIsAvailable(json.item.is_available);
            } catch (err) {
                console.error(err);
                setIsAvailable(!newState);
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        let nextStockQuantity = item.stock_quantity ?? null;
        let nextIsAvailable = isAvailable;

        if (item.stock_enabled && !isNew) {
            const rawStock = stockInput.trim();
            const parsedStock = Number(rawStock);

            if (
                rawStock === "" ||
                Number.isNaN(parsedStock) ||
                parsedStock < 0 ||
                !Number.isInteger(parsedStock)
            ) {
                setStockInput(String(item.stock_quantity ?? 0));
                setToast({
                    message: "Informe uma quantidade válida.",
                    type: "error",
                });
                return;
            }

            nextStockQuantity = parsedStock;
            if (parsedStock !== Number(item.stock_quantity ?? 0)) {
                nextIsAvailable = parsedStock > 0;
            }
        }

        const nextPriceCents = priceInputToCents(priceInput);
        setPriceCents(nextPriceCents);
        setPriceInput(formatPriceInput(nextPriceCents));
        setIsLoading(true);

        try {
            if (
                item.stock_enabled &&
                !isNew &&
                nextStockQuantity !== item.stock_quantity
            ) {
                const { error } = await supabase
                    .from("items")
                    .update({
                        stock_quantity: nextStockQuantity,
                        is_available: nextIsAvailable,
                    })
                    .eq("id", item.id)
                    .eq("restaurant_id", restaurantId);

                if (error) throw error;
                setIsAvailable(nextIsAvailable);
            }

            await onSave({
                ...item,
                name,
                description,
                price_cents: nextPriceCents,
                image_path: imagePath,
                image_url: imageUrl,
                is_available: nextIsAvailable,
                ...(item.stock_enabled && !isNew
                    ? { stock_quantity: nextStockQuantity }
                    : {}),
            });

            if (isNew) {
                setName("");
                setPriceCents(0);
                setPriceInput(formatPriceInput(0));
                setDescription("");
                setImageUrl(null);
                setImagePath(null);
                if (onCancel) onCancel();
            } else {
                setIsEditing(false);
                onEditingChange?.(false);
            }
        } catch {
            alert("Erro ao salvar.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
            if (isNew) handleSave();
        }

        if (e.key === "Escape") {
            if (isNew && onCancel) {
                onCancel();
            } else {
                setName(item.name);
                setPriceCents(item.price_cents);
                setPriceInput(formatPriceInput(item.price_cents));
                setIsEditing(false);
                onEditingChange?.(false);
            }
        }
    };

    const renderStockInput = () => {
        if (!item.stock_enabled || isNew) return null;

        return (
            <div
                className="panel-menu-stock w-24 shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <Input label="Estoque" aria-label={`Estoque de ${name}`}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
                    onBlur={handleStockBlur}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="text-right tabular-nums"
                    disabled={isLoading}
                />
            </div>
        );
    };

    const renderImageArea = () => (
        <div
            key={`menu-item-image-${item.id || "new"}-${
                isEditing ? "editing" : "viewing"
            }`}
            onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
            }}
            className="w-12 h-12 2xl:h-18 2xl:w-18 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200 cursor-pointer hover:bg-gray-200 transition-all relative group/img"
        >
            <input
                key={`menu-item-file-input-${item.id || "new"}-${
                    isEditing ? "editing" : "viewing"
                }`}
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {isUploading ? (
                <FontAwesomeIcon
                    icon={faSpinner}
                    className="animate-spin text-brand"
                />
            ) : imageUrl ? (
                <>
                    <img
                        src={imageUrl}
                        alt={name}
                        className={`w-full h-full object-cover ${
                            !isAvailable ? "grayscale" : ""
                        }`}
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <FontAwesomeIcon
                            icon={faImage}
                            className="text-white text-xs"
                        />
                    </div>
                </>
            ) : (
                <FontAwesomeIcon icon={faImage} />
            )}
        </div>
    );

    if (!isEditing) {
        return (
            <>
                <div
                    className={`panel-menu-row group flex items-center justify-between p-4 2xl:p-5 bg-white border-b border-gray-100 hover:bg-gray-50 transition-all cursor-pointer ${
                        !isAvailable ? "opacity-60 bg-gray-50" : ""
                    }`}
                    onClick={() => {
                        setIsEditing(true);
                        onEditingChange?.(true);
                    }}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden 2xl:gap-4">
                        {dragHandle && (
                            <div
                                className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 -ml-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {dragHandle}
                            </div>
                        )}

                        {renderImageArea()}

                        <div className="flex min-w-0 flex-1 flex-col 2xl:text-lg">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium text-gray-900">
                                    {name}
                                </span>
                                {!isAvailable && (
                                    <span className="shrink-0 text-[10px] font-bold text-red-500 uppercase">
                                        Pausado
                                    </span>
                                )}
                                {item.stock_enabled &&
                                    Number(stockInput || 0) <= 0 && (
                                        <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                            Sem estoque
                                        </span>
                                    )}
                            </div>

                            {description ? (
                                <span className="text-xs 2xl:text-base text-gray-500 truncate block max-w-[200px] sm:max-w-xs">
                                    {description}
                                </span>
                            ) : (
                                <span className="text-xs 2xl:text-base text-gray-300 italic">
                                    Sem descrição...
                                </span>
                            )}
                            <span className="mt-1 font-medium text-gray-900 tabular-nums md:hidden">
                                {(priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                        </div>
                        {renderStockInput()}
                    </div>

                    <div className="flex items-center gap-4 2xl:gap-6 pl-4 2xl:text-lg">

                        <span className="hidden font-medium text-gray-900 whitespace-nowrap md:inline">
                            {(priceCents / 100).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                            })}
                        </span>

                        {!isNew && (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onOpenDetails) onOpenDetails();
                                    }}
                                    className="px-3 py-1.5 h-auto text-sm font-medium text-gray-500 hover:border-brand gap-2"
                                    title="Gerenciar complementos e opções"
                                >
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    <span className="hidden sm:inline">
                                        Complementos
                                    </span>
                                </Button>

                                <Tooltip
                                    text="Copiar link que leva direto para o Item"
                                    position="top"
                                >
                                    <button
                                        aria-label={`Copiar link de ${name}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy();
                                    }}
                                        className="cursor-pointer w-8 h-8 2xl:text-2xl flex items-center justify-center text-gray-400 hover:text-brand hover:bg-gray-50 rounded-full transition-colors"
                                    >
                                        <FontAwesomeIcon
                                            icon={
                                                copied
                                                    ? icons.faCheck
                                                    : icons.faLink
                                            }
                                        />
                                    </button>
                                </Tooltip>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onDuplicate) onDuplicate(item);
                                    }}
                                    className="cursor-pointer w-8 h-8 2xl:text-2xl flex items-center justify-center text-gray-400 hover:text-brand hover:bg-gray-50 rounded-full transition-colors"
                                    title="Duplicar item"
                                >
                                    <FontAwesomeIcon icon={icons.faCopy} />
                                </button>
                            </>
                        )}

                        <Switch checked={isAvailable} onClick={handleToggleAvailability} aria-label={isAvailable ? "Pausar item" : "Ativar item"} title={isAvailable ? "Pausar item" : "Ativar item"} />

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleteModalOpen(true);
                            }}
                            className="cursor-pointer w-8 h-8 2xl:text-2xl flex items-center justify-center text-gray-400 hover:text-red-600 transition-all"
                            title="Deletar item"
                        >
                            <FontAwesomeIcon icon={icons.faTrash} />
                        </button>
                    </div>
                </div>

                <ConfirmModal
                    open={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={() => {
                        if (onDelete) onDelete(item.id);
                        setIsDeleteModalOpen(false);
                    }}
                    title="Excluir Item"
                    description={`Tem certeza que deseja excluir "${name}"?`}
                    confirmLabel="Excluir"
                    variant="danger"
                />
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </>
        );
    }

    return (
        <div className="panel-menu-editor relative z-10 flex min-w-0 max-w-full flex-col gap-4 border-b border-gray-200 bg-white p-4">
            <div className="flex w-full min-w-0 flex-1 items-start gap-4 2xl:items-center">
                {renderImageArea()}
                <div className="w-full min-w-0 flex-1 space-y-3">
                    <Input label="Nome do item"
                        ref={nameInputRef}
                        value={name ?? ""}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => autoSave()}
                        onKeyDown={handleKeyDown}
                        placeholder="Nome do item"
                        className="min-w-0"
                        disabled={isLoading}
                    />
                    <Input label="Descrição"
                        value={description ?? ""}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => autoSave()}
                        onKeyDown={handleKeyDown}
                        placeholder="Adicione uma descrição..."
                        className="min-w-0"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-end justify-end gap-3">
                {renderStockInput()}

                <div className="w-32">
                    <Input label="Preço" icon="R$"
                        type="text"
                        inputMode="decimal"
                        value={priceInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                            const nextValue = sanitizePriceInput(
                                e.target.value
                            );
                            setPriceInput(nextValue);
                            setPriceCents(priceInputToCents(nextValue));
                        }}
                        onBlur={handlePriceBlur}
                        onKeyDown={handleKeyDown}
                        className="text-right tabular-nums"
                        placeholder="0,00"
                        disabled={isLoading}
                    />
                </div>

                <div className="flex items-center gap-1">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="2xl:text-xl cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <FontAwesomeIcon icon={icons.faTimes} />
                        </button>
                    )}
                    <Button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSave}
                        loading={isLoading}
                        className="gap-2"
                    >
                        {isLoading ? (
                            "..."
                        ) : (
                            <>
                                <FontAwesomeIcon icon={icons.faCheck} /> Salvar
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

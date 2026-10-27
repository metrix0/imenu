"use client";

import {
    type ChangeEvent,
    type DragEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { supabase } from "@/lib/database/supabaseClient";
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import Toast from "@/components/ui/Toast";
import LoadingBar from "@/components/ui/LoadingBar";
import { uploadFullMenuImageAI } from "@/lib/database/uploadFullMenuImageAI";
import { arePizzaFlavorsCompatible, prepareScannedPizza, type ScannedPizzaOption } from "@/lib/menu/scannedPizza";
import { parsePizzaSettings } from "@/lib/pizza/pricing";
import Loader from "@/components/ui/Loader";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { faCamera, faImages } from "@fortawesome/free-solid-svg-icons";

type ScannedItem = {
    name: string;
    description: string | null;
    price_cents: number | null;
    image_path: string | null;
    category_name?: string;
    category_id?: string | null;
    is_pizza_flavor?: boolean;
    pizza_sizes?: ScannedPizzaOption[];
    pizza_crusts?: ScannedPizzaOption[];
    [key: string]: any;
};

type ScannedResult = {
    items: ScannedItem[];
    categories: { name: string }[];
};

type SelectedUpload = {
    id: string;
    file: File;
    previewUrl: string;
    publicUrl: string | null;
    status: "uploading" | "done" | "error";
};

type CategoryMapping = {
    mappedId: string | null;
    createNew: boolean;
};

type ExistingMenuItem = {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    category_id: string;
};

type ScanAccess = { allowed: boolean; hasItems: boolean; hasPlus: boolean };

const normalizeItemName = (name: string) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

const MAX_MENU_FILES = 8;

export default function ScanMenuModal({
    open,
    onClose,
    restaurantId,
    existingCategories,
    onRefresh,
    onUpgrade,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    existingCategories: { id: string; name: string; position: number }[];
    onRefresh: () => void;
    onUpgrade: () => void;
}) {
    return (
        <ScanModal
            onRefresh={onRefresh}
            open={open}
            onClose={onClose}
            restaurantId={restaurantId}
            existingCategories={existingCategories}
            onUpgrade={onUpgrade}
        />
    );
}

function ScanModal({
    open,
    onClose,
    restaurantId,
    existingCategories,
    onRefresh,
    onUpgrade,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    existingCategories: { id: string; name: string; position: number }[];
    onRefresh: () => void;
    onUpgrade: () => void;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewUrlsRef = useRef<Set<string>>(new Set());

    const [uploads, setUploads] = useState<SelectedUpload[]>([]);
    const [menuUrl, setMenuUrl] = useState("");
    const [showLinkField, setShowLinkField] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
    const [access, setAccess] = useState<ScanAccess | null>(null);
    const [accessError, setAccessError] = useState("");
    const [existingItems, setExistingItems] = useState<ExistingMenuItem[]>([]);
    const [itemActions, setItemActions] = useState<Record<number, "add" | "update" | "skip">>({});
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [categoryMap, setCategoryMap] = useState<
        Record<string, CategoryMapping>
    >({});

    useEffect(() => {
        return () => {
            previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            previewUrlsRef.current.clear();
        };
    }, []);

    async function fetchScanAccess(): Promise<ScanAccess> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Entre na sua conta para usar o scanner.");
        const response = await fetch(`/api/scan-menu?restaurantId=${encodeURIComponent(restaurantId)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Não foi possível verificar o acesso.");
        return payload as ScanAccess;
    }

    useEffect(() => {
        if (!open) return;
        let active = true;
        setScanResult(null);
        setItemActions({});
        setAccess(null);
        setAccessError("");
        void fetchScanAccess().then(value => {
            if (!active) return;
            if (!value.allowed) {
                onUpgrade();
                return;
            }
            setAccess(value);
        }).catch(error => {
            if (active) setAccessError(error instanceof Error ? error.message : String(error));
        });
        return () => { active = false; };
    }, [open, restaurantId]);

    async function loadExistingItems() {
        const { data, error } = await supabase.from("items")
            .select("id, name, description, price_cents, category_id")
            .eq("restaurant_id", restaurantId)
            .order("position")
            .limit(1000);
        if (error) throw error;
        setExistingItems((data || []) as ExistingMenuItem[]);
    }

    function findExistingItem(item: ScannedItem, categoryName: string): ExistingMenuItem | undefined {
        const mappedId = categoryMap[categoryName]?.mappedId;
        const categoryIds = mappedId ? [mappedId] : existingCategories
            .filter(category => normalizeItemName(category.name) === normalizeItemName(categoryName))
            .map(category => category.id);
        return existingItems.find(existing =>
            normalizeItemName(existing.name) === normalizeItemName(item.name) &&
            categoryIds.includes(existing.category_id)
        );
    }

    function selectedAction(item: ScannedItem, categoryName: string): "add" | "update" | "skip" {
        const index = scanResult?.items.indexOf(item) ?? -1;
        return itemActions[index] ?? (findExistingItem(item, categoryName) ? "skip" : "add");
    }

    function scheduleToastClear(delay = 3000) {
        window.setTimeout(() => setToast(null), delay);
    }

    async function handleFilesSelected(selectedFiles: FileList | null) {
        if (!selectedFiles) return;

        const selected = Array.from(selectedFiles);
        if (selected.length === 0) return;

        const remainingSlots = MAX_MENU_FILES - uploads.length;

        if (remainingSlots <= 0 || selected.length > remainingSlots) {
            setToast({
                type: "error",
                message: `Você pode enviar no máximo ${MAX_MENU_FILES} PDFs e/ou imagens.`,
            });
            scheduleToastClear(3500);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            return;
        }

        const newUploads: SelectedUpload[] = selected.map((file) => {
            const previewUrl = URL.createObjectURL(file);
            previewUrlsRef.current.add(previewUrl);

            return {
                id: crypto.randomUUID(),
                file,
                previewUrl,
                publicUrl: null,
                status: "uploading",
            };
        });

        setUploads((current) => [...current, ...newUploads]);

        for (const upload of newUploads) {
            try {
                const publicUrl = await uploadFullMenuImageAI(upload.file, true);

                setUploads((current) =>
                    current.map((entry) =>
                        entry.id === upload.id
                            ? {
                                  ...entry,
                                  publicUrl,
                                  status: "done",
                              }
                            : entry
                    )
                );

                setToast({
                    type: "success",
                    message: `Imagem "${upload.file.name}" enviada com sucesso!`,
                });
            } catch (error) {
                console.error("UPLOAD ERROR", error);

                setUploads((current) =>
                    current.map((entry) =>
                        entry.id === upload.id
                            ? {
                                  ...entry,
                                  publicUrl: null,
                                  status: "error",
                              }
                            : entry
                    )
                );

                setToast({
                    type: "error",
                    message: `Erro ao enviar "${upload.file.name}".`,
                });
            } finally {
                scheduleToastClear();
            }
        }
    }

    function openFilePicker() {
        if (uploads.length >= MAX_MENU_FILES) {
            setToast({
                type: "error",
                message: `Você pode enviar no máximo ${MAX_MENU_FILES} PDFs e/ou imagens.`,
            });
            scheduleToastClear(3500);
            return;
        }

        fileInputRef.current?.click();
    }

    function removeUpload(id: string) {
        setUploads((current) => {
            const removed = current.find((entry) => entry.id === id);
            if (removed) {
                URL.revokeObjectURL(removed.previewUrl);
                previewUrlsRef.current.delete(removed.previewUrl);
            }

            return current.filter((entry) => entry.id !== id);
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function resetUploads() {
        uploads.forEach((upload) => {
            URL.revokeObjectURL(upload.previewUrl);
            previewUrlsRef.current.delete(upload.previewUrl);
        });
        setUploads([]);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    async function callAiScan(urls: string[], pastedMenuUrl?: string) {
        setIsScanning(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Entre na sua conta para usar o scanner.");
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            };
            const response = await fetch("/api/scan-menu", {
                method: "POST",
                headers,
                body: JSON.stringify({ restaurantId, urls, ...(pastedMenuUrl !== undefined ? { menuUrl: pastedMenuUrl } : {}) }),
            });
            const json = await response.json();

            if (!response.ok) {
                if (json?.requiresPlus) {
                    onUpgrade();
                    return null;
                }
                setToast({
                    message: json?.error || "O Scan com IA falhou",
                    type: "error",
                });
                return null;
            }

            setToast({
                message: "Scan com IA realizado",
                type: "success",
            });
            scheduleToastClear();
            return json as ScannedResult;
        } catch (error: any) {
            console.error(error);
            setToast({
                message: "AI scan error: " + (error?.message ?? error),
                type: "error",
            });
            return null;
        } finally {
            setIsScanning(false);
        }
    }

    async function showScanResult(aiResult: ScannedResult) {
        try {
            await loadExistingItems();
        } catch (error) {
            setToast({
                message: "Não foi possível comparar com os produtos existentes: " +
                    (error instanceof Error ? error.message : String(error)),
                type: "error",
            });
            return;
        }
        setItemActions({});
        setScanResult(aiResult);
        const newMap: Record<string, CategoryMapping> = {};
        (aiResult.categories || []).forEach((category) => {
            const match = existingCategories.find(existing =>
                existing.name.trim().localeCompare(category.name.trim(), "pt-BR", { sensitivity: "base" }) === 0
            );
            newMap[category.name] = match
                ? { mappedId: match.id, createNew: false }
                : { mappedId: null, createNew: true };
        });
        setCategoryMap(newMap);
    }

    async function handleContinue() {
        if (showLinkField) {
            if (!menuUrl.trim()) {
                setToast({
                    message: "Cole o link público do seu cardápio.",
                    type: "error",
                });
                return;
            }
            const aiResult = await callAiScan([], menuUrl.trim());
            if (aiResult) await showScanResult(aiResult);
            return;
        }

        if (uploads.length === 0) {
            setToast({
                message: "Adicione ao menos 1 foto",
                type: "error",
            });
            scheduleToastClear(2500);
            return;
        }

        if (uploads.length > MAX_MENU_FILES) {
            setToast({
                message: `Você pode enviar no máximo ${MAX_MENU_FILES} PDFs e/ou imagens.`,
                type: "error",
            });
            scheduleToastClear(3500);
            return;
        }

        if (uploads.some((upload) => upload.status === "uploading")) {
            setToast({
                message: "Aguarde: imagens ainda estão sendo enviadas.",
                type: "error",
            });
            scheduleToastClear(2500);
            return;
        }

        const failedUploads = uploads.filter(
            (upload) => upload.status === "error" || !upload.publicUrl
        );

        if (failedUploads.length > 0) {
            setToast({
                message:
                    failedUploads.length === 1
                        ? "Uma imagem não foi enviada. Remova-a e adicione novamente."
                        : `${failedUploads.length} imagens não foram enviadas. Remova-as e adicione novamente.`,
                type: "error",
            });
            scheduleToastClear(4000);
            return;
        }

        const publicUrls = uploads.map((upload) => upload.publicUrl as string);

        if (publicUrls.length !== uploads.length) {
            setToast({
                message: "Nem todas as imagens ficaram prontas para análise.",
                type: "error",
            });
            scheduleToastClear(3500);
            return;
        }

        console.info(
            `[SCAN_MENU] Sending ${publicUrls.length} of ${uploads.length} selected files`
        );

        const aiResult = await callAiScan(publicUrls);
        if (!aiResult) return;

        await showScanResult(aiResult);
    }

    async function handleSaveAll() {
        if (!scanResult || isSaving) return;
        setIsSaving(true);

        try {
            const currentAccess = await fetchScanAccess();
            if (!currentAccess.allowed) {
                onUpgrade();
                return;
            }

            const itemsToAdd = scanResult.items.filter(item => selectedAction(item, item.category_name ?? "") === "add");
            const itemsToUpdate = scanResult.items.filter(item => selectedAction(item, item.category_name ?? "") === "update");
            if (!itemsToAdd.length && !itemsToUpdate.length) {
                setToast({ message: "Nenhuma alteração selecionada.", type: "success" });
                return;
            }

            for (const item of itemsToUpdate) {
                const original = findExistingItem(item, item.category_name ?? "");
                if (!original) throw new Error(`Selecione um produto existente para atualizar ${item.name}.`);
                const price = prepareScannedPizza(item).price_cents;
                const hasValidPrice = Number.isSafeInteger(item.price_cents) && Number(item.price_cents) >= 0 ||
                    (item.is_pizza_flavor === true && prepareScannedPizza(item).complements.some(group => group.name === "Tamanho"));
                const { data, error } = await supabase.from("items")
                    .update({
                        name: item.name,
                        ...(item.description !== null ? { description: item.description } : {}),
                        ...(hasValidPrice ? { price_cents: price } : {}),
                    })
                    .eq("restaurant_id", restaurantId).eq("id", original.id).select("id");
                if (error || !data?.length) throw new Error(error?.message || `Não foi possível atualizar ${item.name}.`);
            }

            const resolvedCategoryIds = new Map<string, string>();
            for (const category of scanResult.categories.filter(category =>
                itemsToAdd.some(item => item.category_name === category.name))) {
                const mapping = categoryMap[category.name];
                if (mapping?.mappedId) {
                    resolvedCategoryIds.set(category.name, mapping.mappedId);
                    continue;
                }
                const response = await fetch("/api/categories/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        restaurant_id: restaurantId,
                        name: category.name,
                        position: 99,
                    }),
                });
                const json = await response.json();
                if (!response.ok || !json?.category?.id) {
                    throw new Error(json?.error || `Não foi possível criar a categoria ${category.name}.`);
                }
                resolvedCategoryIds.set(category.name, json.category.id);
            }

            const imported = await Promise.all(itemsToAdd.map(async (item, index) => {
                const categoryId = resolvedCategoryIds.get(item.category_name ?? "");
                if (!categoryId) throw new Error(`Categoria não encontrada para ${item.name}.`);
                const prepared = prepareScannedPizza(item);
                const hasPrice = (Number.isSafeInteger(item.price_cents) && Number(item.price_cents) >= 0) ||
                    (item.is_pizza_flavor === true &&
                        prepared.complements.some(group => group.name === "Tamanho"));
                const response = await fetch("/api/items/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        restaurant_id: restaurantId,
                        category_id: categoryId,
                        name: item.name,
                        description: item.description,
                        price_cents: prepared.price_cents,
                        image_path: item.image_path ?? null,
                        is_available: Boolean(hasPrice),
                        position: index,
                    }),
                });
                const json = await response.json();
                if (!response.ok || !json?.item?.id) {
                    throw new Error(json?.error || `Não foi possível criar ${item.name}.`);
                }
                return { item, categoryId, itemId: json.item.id as string, prepared };
            }));

            const groupPlans = imported.flatMap(({ itemId, prepared }) =>
                prepared.complements.map(group => ({ itemId, ...group }))
            );
            if (groupPlans.length) {
                const { data: createdGroups, error: groupError } = await supabase
                    .from("item_subcategories")
                    .insert(groupPlans.map(group => ({
                        item_id: group.itemId,
                        name: group.name,
                        min_select: group.min_select,
                        max_select: group.max_select,
                        allow_multiple_units: false,
                        position: group.name === "Tamanho" ? 0 : 1,
                    })))
                    .select("id, item_id, name");
                if (groupError || !createdGroups || createdGroups.length !== groupPlans.length) {
                    throw new Error(groupError?.message || "Não foi possível criar tamanhos e bordas.");
                }

                const options = createdGroups.flatMap(created => {
                    const group = groupPlans.find(plan =>
                        plan.itemId === created.item_id && plan.name === created.name
                    );
                    if (!group) throw new Error("Grupo de pizza não encontrado.");
                    return group.options.map((option, position) => ({
                        item_subcategory_id: created.id,
                        name: option.name,
                        description: null,
                        price_cents: option.price_cents,
                        is_available: true,
                        position,
                    }));
                });
                if (options.length) {
                    const { error: optionError } = await supabase.from("subitems").insert(options);
                    if (optionError) throw new Error(optionError.message);
                }
            }

            const pizzaFlavors = imported.filter(row => row.item.is_pizza_flavor === true);
            const pizzaCategoryIds = [...new Set(pizzaFlavors.map(row => row.categoryId))]
                .filter(categoryId => !imported.some(row =>
                    row.categoryId === categoryId && row.item.is_pizza_flavor !== true
                ));
            let needsPizzaReview = pizzaFlavors.length >= 2 && pizzaCategoryIds.length === 0;
            if (pizzaFlavors.length >= 2 && pizzaCategoryIds.length) {
                const { data: allCategoryItems, error: itemsError } = await supabase.from("items")
                    .select("id, category_id").in("category_id", pizzaCategoryIds);
                if (itemsError) throw new Error(itemsError.message);
                const createdItemIds = new Set(imported.map(row => row.itemId));
                const safeIds = pizzaCategoryIds.filter(categoryId =>
                    !(allCategoryItems || []).some(row =>
                        row.category_id === categoryId && !createdItemIds.has(row.id)
                    )
                );
                const eligibleFlavors = pizzaFlavors.filter(row => safeIds.includes(row.categoryId));
                if (eligibleFlavors.length >= 2 &&
                    arePizzaFlavorsCompatible(eligibleFlavors.map(row => row.item))) {
                    const { data: restaurant, error: restaurantError } = await supabase
                        .from("restaurants").select("pizza_settings").eq("id", restaurantId).single();
                    if (restaurantError) throw new Error(restaurantError.message);
                    const current = parsePizzaSettings(restaurant.pizza_settings);
                    const { error: settingsError } = await supabase.from("restaurants")
                        .update({ pizza_settings: {
                            ...current,
                            enabled: true,
                            category_ids: [...new Set([...current.category_ids, ...safeIds])],
                        } })
                        .eq("id", restaurantId);
                    if (settingsError) throw new Error(settingsError.message);
                } else {
                    needsPizzaReview = true;
                }
            }

            setToast({
                message: needsPizzaReview
                    ? "Cardápio importado. Revise os tamanhos e bordas dos sabores para ativar o Modo Pizza."
                    : "Cardápio importado com sucesso",
                type: "success",
            });
            scheduleToastClear(2500);
            onClose();
        } catch (error: unknown) {
            console.error(error);
            setToast({
                message: "Erro ao importar. Confira os itens já criados antes de tentar novamente: " +
                    (error instanceof Error ? error.message : String(error)),
                type: "error",
            });
            scheduleToastClear(6000);
        } finally {
            onRefresh();
            setIsSaving(false);
        }
    }

    const aiCategories = useMemo(
        () => (scanResult?.categories || []).map((category) => category.name),
        [scanResult]
    );

    const itemsGrouped = useMemo(() => {
        const grouped: Record<string, ScannedItem[]> = {};

        (scanResult?.items || []).forEach((item) => {
            const category = item.category_name ?? "_uncategorized";
            grouped[category] = grouped[category] || [];
            grouped[category].push(item);
        });

        return grouped;
    }, [scanResult]);

    function handleMapCategory(
        categoryName: string,
        mappedId: string | null,
        createNew = false
    ) {
        setCategoryMap((current) => ({
            ...current,
            [categoryName]: { mappedId, createNew },
        }));
    }

    function openCamera() {
        if (uploads.length >= MAX_MENU_FILES) {
            setToast({
                type: "error",
                message: `Você pode enviar no máximo ${MAX_MENU_FILES} PDFs e/ou imagens.`,
            });
            scheduleToastClear(3500);
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.setAttribute("capture", "environment");
        input.onchange = async () => {
            await handleFilesSelected(input.files);
        };
        input.click();
    }

    return (
        <>
            <Modal height={700} open={open && (access?.allowed === true || Boolean(accessError))} onClose={onClose}>
                <div className="p-6 w-full max-w-3xl 2xl:max-w-4xl overflow-y-auto">
                    {!access && !accessError && <div className="flex min-h-40 items-center justify-center"><Loader /></div>}
                    {accessError && <div className="space-y-4">
                        <p role="alert" className="text-sm text-red-700">{accessError}</p>
                        <Button variant="secondary" onClick={() => void fetchScanAccess().then(value => {
                            setAccessError("");
                            setAccess(value);
                        }).catch(error => setAccessError(error instanceof Error ? error.message : String(error)))}>Tentar novamente</Button>
                    </div>}
                    {access?.allowed && !scanResult && (
                        <div className="space-y-4">
                            {showLinkField ? (
                                <div className="rounded-lg p-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuUrl("");
                                            setShowLinkField(false);
                                        }}
                                        className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand hover:underline"
                                    >
                                        ← Usar fotos ou PDF
                                    </button>
                                    <Input
                                        type="url"
                                        label="Link público do cardápio"
                                        placeholder="https://exemplo.com/cardapio"
                                        value={menuUrl}
                                        onChange={(event) => setMenuUrl(event.target.value)}
                                        maxLength={2048}
                                        autoFocus
                                    />
                                </div>
                            ) : (
                            <div className="rounded-lg p-4 2xl:text-xl">
                                <div className="mb-6">
                                    <p className="font-semibold 2xl:mb-2">
                                        Adicione fotos ou PDF
                                    </p>
                                    <p className="text-sm text-gray-500 2xl:text-base">
                                        JPG, PNG, PDF. <b>Use os arquivos de imagem do seu cardápio para melhores resultados.</b> Limite: 8 PDFs e/ou imagens.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-8">
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*,.pdf"
                                            multiple
                                            className="hidden"
                                            onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                                void handleFilesSelected(
                                                    event.target.files
                                                );
                                            }}
                                        />
                                        <Button
                                            variant="secondary"
                                            onClick={openFilePicker}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <FontAwesomeIcon icon={faImages} />
                                                Adicionar fotos
                                            </span>
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={openCamera}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <FontAwesomeIcon icon={faCamera} />
                                                Abrir câmera
                                            </span>
                                        </Button>
                                        {uploads.length === 0 && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => setShowLinkField(true)}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <FontAwesomeIcon icon={icons.faLink} />
                                                    Importar cardápio usando um Link
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 mb-6">
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {uploads.map((upload) => (
                                            <div
                                                key={upload.id}
                                                className="relative w-28 h-28 2xl:w-36 2xl:h-36 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
                                            >
                                                {upload.status === "uploading" && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                                        <Loader />
                                                    </div>
                                                )}
                                                <img
                                                    src={upload.previewUrl}
                                                    className="w-full h-full object-cover"
                                                    alt={upload.file.name}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeUpload(upload.id)
                                                    }
                                                    className="cursor-pointer absolute top-1 right-1 2xl:top-2 2xl:right-2 bg-black/50 text-white rounded-full w-6 h-6 2xl:w-8 2xl:h-8 text-xs 2xl:text-sm flex items-center justify-center z-20"
                                                >
                                                    ✕
                                                </button>

                                                <div className="absolute left-1 bottom-1 text-xs bg-white/80 px-1 rounded 2xl:text-base z-20">
                                                    {upload.status === "uploading"
                                                        ? "..."
                                                        : upload.status === "error"
                                                          ? "ERRO"
                                                          : <FontAwesomeIcon icon={icons.faCheck} />}
                                                </div>
                                            </div>
                                        ))}

                                        {uploads.length < MAX_MENU_FILES && (
                                            <div
                                                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                                                    event.preventDefault();
                                                    setIsDraggingImage(true);
                                                }}
                                                onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                                                    event.preventDefault();
                                                    setIsDraggingImage(false);
                                                }}
                                                onDrop={(event: DragEvent<HTMLDivElement>) => {
                                                    event.preventDefault();
                                                    setIsDraggingImage(false);
                                                    void handleFilesSelected(
                                                        event.dataTransfer.files
                                                    );
                                                }}
                                                className={`rounded-lg border-dashed border-2 flex items-center justify-center flex-shrink-0
                                                    ${uploads.length === 0 ? "w-full h-28" : "w-28 h-28 2xl:w-36 2xl:h-36"}
                                                    ${isDraggingImage ? "border-brand text-brand" : "border-gray-300 text-gray-500"}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={openFilePicker}
                                                    className="w-full h-full text-sm 2xl:text-lg cursor-pointer"
                                                >
                                                    + Arraste suas fotos aqui
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            )}

                            <div className="h-10 px-4" aria-live="polite">
                                {isScanning && (
                                    <LoadingBar
                                        key={String(isScanning)}
                                        durationSeconds={13}
                                        showLabel={true}
                                    />
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={onClose}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleContinue}
                                    loading={isScanning}
                                >
                                    Continuar
                                </Button>
                            </div>
                        </div>
                    )}

                    {access?.allowed && scanResult && (
                        <div className="space-y-6">
                            <p className="text-sm text-gray-600">
                                Revise os itens encontrados. Itens já cadastrados são ignorados por padrão.
                                Atualizar altera nome, descrição e preço; complementos existentes são mantidos.
                            </p>
                            <div className="space-y-6">
                                {aiCategories.map((categoryName) => {
                                    const mapping = categoryMap[categoryName] ?? {
                                        mappedId: null,
                                        createNew: true,
                                    };
                                    const dropdownOptions = [
                                        {
                                            value: "__create_new__",
                                            label: `Criar nova categoria (“${categoryName}”)`,
                                        },
                                        ...existingCategories.map((category) => ({
                                            value: category.id,
                                            label: category.name,
                                        })),
                                    ];
                                    const items =
                                        itemsGrouped[categoryName] ?? [];

                                    return (
                                        <div
                                            key={categoryName}
                                            className="bg-white p-4 rounded-lg shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-4 mb-6">
                                                <div className="flex-1">
                                                    <div className="text-sm text-gray-500 2xl:text-base">
                                                        Categoria detectada
                                                    </div>
                                                    <div className="font-semibold text-lg">
                                                        {categoryName}
                                                    </div>
                                                </div>

                                                <div className="w-[320px]">
                                                    <Dropdown
                                                        label="Mapear para"
                                                        value={
                                                            mapping.mappedId ??
                                                            "__create_new__"
                                                        }
                                                        options={dropdownOptions}
                                                        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                            const value =
                                                                event.target.value;
                                                            if (
                                                                value ===
                                                                "__create_new__"
                                                            ) {
                                                                handleMapCategory(
                                                                    categoryName,
                                                                    null,
                                                                    true
                                                                );
                                                            } else {
                                                                handleMapCategory(
                                                                    categoryName,
                                                                    value,
                                                                    false
                                                                );
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {items.length === 0 ? (
                                                    <div className="text-sm text-gray-500">
                                                        Nenhum item detectado nesta categoria.
                                                    </div>
                                                ) : (
                                                    items.map((item, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex gap-4 items-start"
                                                        >
                                                            <div className="flex-1">
                                                                <div className="font-medium text-base">
                                                                    {item.name}
                                                                </div>
                                                                <div className="text-sm text-gray-600 mt-1">
                                                                    {item.description}
                                                                </div>
                                                                <div className="mt-2 max-w-56">
                                                                    <Dropdown
                                                                        label={`Ação para ${item.name}`}
                                                                        value={selectedAction(item, categoryName)}
                                                                        options={[
                                                                            { value: "add", label: "Adicionar" },
                                                                            ...(findExistingItem(item, categoryName)
                                                                                ? [{ value: "update", label: "Atualizar existente" }]
                                                                                : []),
                                                                            { value: "skip", label: "Ignorar" },
                                                                        ]}
                                                                        onChange={event => setItemActions(current => ({
                                                                            ...current,
                                                                            [scanResult.items.indexOf(item)]: event.target.value as "add" | "update" | "skip",
                                                                        }))}
                                                                    />
                                                                </div>
                                                                {item.is_pizza_flavor && (
                                                                    <div className="mt-1 text-xs text-gray-500">
                                                                        Sabor de pizza
                                                                        {item.pizza_sizes?.length ? ` · Tamanhos: ${item.pizza_sizes.map(size => size.name).join(", ")}` : ""}
                                                                        {item.pizza_crusts?.length ? ` · Bordas: ${item.pizza_crusts.map(crust => crust.name).join(", ")}` : ""}
                                                                    </div>
                                                                )}
                                                                <div className="text-sm font-semibold mt-2">
                                                                    {(typeof item.price_cents === "number" ||
                                                                        (item.is_pizza_flavor && prepareScannedPizza(item).complements.some(group => group.name === "Tamanho"))) &&
                                                                    prepareScannedPizza(item).price_cents >= 0
                                                                        ? `R$ ${(prepareScannedPizza(item).price_cents / 100).toFixed(2).replace(".", ",")}`
                                                                        : "—"}
                                                                </div>
                                                            </div>

                                                            <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                                                {item.image_path ? (
                                                                    <img
                                                                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/full-menu-images-ai/${item.image_path}`}
                                                                        className="w-full h-full object-cover"
                                                                        alt={item.name}
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src="/placeholders/item.png"
                                                                        alt="no image"
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setScanResult(null);
                                        resetUploads();
                                    }}
                                >
                                    Voltar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSaveAll}
                                    loading={isSaving}
                                >
                                    Aplicar itens
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            </Modal>

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

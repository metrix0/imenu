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
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import Toast from "@/components/ui/Toast";
import LoadingBar from "@/components/ui/LoadingBar";
import { uploadFullMenuImageAI } from "@/lib/database/uploadFullMenuImageAI";
import Loader from "@/components/ui/Loader";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";

type ScannedItem = {
    name: string;
    description: string | null;
    price_cents: number | null;
    image_path: string | null;
    category_name?: string;
    category_id?: string | null;
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

export default function ScanMenuModal({
    open,
    onClose,
    restaurantId,
    existingCategories,
    onRefresh,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    existingCategories: { id: string; name: string; position: number }[];
    onRefresh: () => void;
}) {
    return (
        <ScanModal
            onRefresh={onRefresh}
            open={open}
            onClose={onClose}
            restaurantId={restaurantId}
            existingCategories={existingCategories}
        />
    );
}

function ScanModal({
    open,
    onClose,
    restaurantId,
    existingCategories,
    onRefresh,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    existingCategories: { id: string; name: string; position: number }[];
    onRefresh: () => void;
}) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewUrlsRef = useRef<Set<string>>(new Set());

    const [uploads, setUploads] = useState<SelectedUpload[]>([]);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
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

    function scheduleToastClear(delay = 3000) {
        window.setTimeout(() => setToast(null), delay);
    }

    async function handleFilesSelected(selectedFiles: FileList | null) {
        if (!selectedFiles) return;

        const selected = Array.from(selectedFiles);
        if (selected.length === 0) return;

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

    async function callAiScan(urls: string[]) {
        setIsScanning(true);

        try {
            const response = await fetch("/api/scan-menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId, urls }),
            });
            const json = await response.json();

            if (!response.ok) {
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

    async function handleContinue() {
        if (uploads.length === 0) {
            setToast({
                message: "Adicione ao menos 1 foto",
                type: "error",
            });
            scheduleToastClear(2500);
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

        setScanResult(aiResult);

        const newMap: Record<string, CategoryMapping> = {};
        (aiResult.categories || []).forEach((category) => {
            newMap[category.name] = {
                mappedId: null,
                createNew: true,
            };
        });
        setCategoryMap(newMap);
    }

    async function handleSaveAll() {
        if (!scanResult) return;
        setIsSaving(true);

        try {
            const createPromises: Promise<{ name: string; id: string }>[] = [];

            for (const [categoryName, mapping] of Object.entries(categoryMap)) {
                if (mapping.mappedId || !mapping.createNew) continue;

                createPromises.push(
                    (async () => {
                        const response = await fetch("/api/categories/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                restaurant_id: restaurantId,
                                name: categoryName,
                                position: 99,
                            }),
                        });
                        const json = await response.json();

                        if (!response.ok) {
                            throw new Error(
                                json?.error || "create category failed"
                            );
                        }

                        return {
                            name: categoryName,
                            id: json.category.id,
                        };
                    })()
                );
            }

            const createdCategories = await Promise.all(createPromises);
            const resolvedCategoryMap = { ...categoryMap };

            createdCategories.forEach((category) => {
                resolvedCategoryMap[category.name] = {
                    mappedId: category.id,
                    createNew: false,
                };
            });

            const createItemPromises: Promise<any>[] = [];

            scanResult.items.forEach((item, index) => {
                const categoryName = item.category_name ?? "Uncategorized";
                const categoryId =
                    resolvedCategoryMap[categoryName]?.mappedId ?? null;

                if (!categoryId) {
                    createItemPromises.push(
                        (async () => {
                            const categoryResponse = await fetch(
                                "/api/categories/create",
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        restaurant_id: restaurantId,
                                        name: categoryName,
                                        position: 0,
                                    }),
                                }
                            );
                            const categoryJson = await categoryResponse.json();

                            const itemResponse = await fetch("/api/items/create", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    restaurant_id: restaurantId,
                                    category_id: categoryJson.category.id,
                                    name: item.name,
                                    description: item.description,
                                    price_cents: item.price_cents ?? 0,
                                    image_path: item.image_path ?? null,
                                    position: index,
                                }),
                            });

                            return itemResponse.json();
                        })()
                    );
                    return;
                }

                createItemPromises.push(
                    fetch("/api/items/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            restaurant_id: restaurantId,
                            category_id: categoryId,
                            name: item.name,
                            description: item.description,
                            price_cents: item.price_cents ?? 0,
                            image_path: item.image_path ?? null,
                            position: index,
                        }),
                    }).then((response) => response.json())
                );
            });

            await Promise.all(createItemPromises);

            setToast({
                message: "Salvo com sucesso",
                type: "success",
            });
            scheduleToastClear(2500);
            onClose();
        } catch (error: any) {
            console.error(error);
            setToast({
                message: "Erro ao salvar: " + (error?.message ?? error),
                type: "error",
            });
            scheduleToastClear(4000);
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
            <Modal open={open} onClose={onClose}>
                <div className="p-6 w-full max-w-3xl 2xl:max-w-4xl overflow-y-auto">
                    {!scanResult && (
                        <div className="space-y-6">
                            <div className="rounded-lg p-4 2xl:text-xl">
                                <div className="mb-6">
                                    <p className="font-semibold 2xl:mb-2">
                                        Adicione seu Cardápio
                                    </p>
                                    <p className="text-sm text-gray-500 2xl:text-base">
                                        JPG, PNG, PDF. <b>Use os arquivos de imagem do seu cardápio para melhores resultados.</b>
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-8">
                                    <div className="flex gap-2 mb-4">
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
                                            Adicionar fotos
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={openCamera}
                                        >
                                            Abrir câmera
                                        </Button>
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
                                                ${uploads.length === 0 ? "w-full h-38" : "w-28 h-28 2xl:w-36 2xl:h-36"}
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
                                    </div>
                                </div>
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

                    {scanResult && (
                        <div className="space-y-6">
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
                                                                <div className="text-sm font-semibold mt-2">
                                                                    {typeof item.price_cents ===
                                                                        "number" &&
                                                                    item.price_cents >= 0
                                                                        ? `R$ ${(item.price_cents / 100).toFixed(2).replace(".", ",")}`
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
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    )}

                    {isScanning && (
                        <div className="mt-4">
                            <LoadingBar
                                key={String(isScanning)}
                                durationSeconds={13}
                                showLabel={true}
                            />
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

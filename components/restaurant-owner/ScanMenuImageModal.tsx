"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button"; // your Button
import Modal from "@/components/ui/Modal"; // your Modal
import Dropdown from "@/components/ui/Dropdown"; // your Dropdown
import Toast from "@/components/ui/Toast"; // your Toast
import LoadingBar from "@/components/ui/LoadingBar"; // your LoadingBar
import { uploadFullMenuImageAI } from "@/lib/uploadFullMenuImageAI"; // your helper that uploads to supabase and returns key
import Loader from "@/components/ui/Loader";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

// Types (match your API)
type ScannedItem = {
    name: string;
    description: string | null;
    price_cents: number | null;
    image_path: string | null;
    category_name?: string;
    category_id?: string | null;
    [k: string]: any;
};

type ScannedResult = {
    items: ScannedItem[];
    categories: { name: string }[];
};

// ---- Replace this with your real restaurant id in runtime ----

export default function ScanMenuModal({
                                          open,
                                          onClose,
                                          restaurantId,
    existingCategories,
    onRefresh
                                      }: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    existingCategories: { id: string; name: string, position: number }[];   // ← type
    onRefresh: () => void;

}) {
    return <ScanModal onRefresh={onRefresh} open={open} onClose={onClose} restaurantId={restaurantId} existingCategories={existingCategories} />;
}

/**
 * Scan Modal - main component
 *
 * Props:
 * - open, onClose
 * - restaurantId (string) - you said you already have this in your code
 */
function ScanModal({ open, onClose, restaurantId, existingCategories, onRefresh }: { open: boolean; onClose(): void; restaurantId: string; existingCategories: { id: string; name: string, position: number }[]; onRefresh: () => void; }) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // local state
    const [files, setFiles] = useState<File[]>([]); // files user selected
    const [thumbUrls, setThumbUrls] = useState<string[]>([]); // object URLs for preview
    const [uploadingKeys, setUploadingKeys] = useState<Record<number, string | null>>({}); // map index -> returned key OR null while uploading
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]); // public URLs to send to AI
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scanResult, setScanResult] = useState<ScannedResult | null>(null);
    const [isDraggingImage, setIsDraggingImage] = useState(false);

    // mapping AI categories -> chosen category id or "create new"
    const [categoryMap, setCategoryMap] = useState<Record<string, { mappedId: string | null; createNew: boolean }>>({});



    // update thumbnails when files change
    useEffect(() => {
        // revoke old urls
        return () => {
            thumbUrls.forEach((u) => URL.revokeObjectURL(u));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [thumbUrls]);

// Called when user picks or drops files
    const handleFilesSelected = async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;
        const arr = Array.from(selectedFiles);
        if (arr.length === 0) return;

        const startIndex = files.length; // where new files begin

        // --- keep UI responsive: add previews & files immediately ---
        const newFiles = [...files, ...arr];
        setFiles(newFiles);
        setThumbUrls((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);

        // mark new files as uploading
        setUploadingKeys((prev) => {
            const updated = { ...prev };
            arr.forEach((_, i) => (updated[startIndex + i] = null)); // null = loading
            return updated;
        });

        // --- then upload each file (sequentially to keep toasts readable) ---
        for (let i = 0; i < arr.length; i++) {
            const file = arr[i];
            const index = startIndex + i;

            try {
                const url = await uploadFullMenuImageAI(file, true); // returns final public URL

                // store uploaded URL in the correct slot
                setUploadedUrls((prev) => {
                    const updated = [...prev];
                    updated[index] = url;
                    return updated;
                });

                // mark as done
                setUploadingKeys((prev) => ({ ...prev, [index]: "OK" }));

                // success toast
                setToast({ type: "success", message: `Imagem "${file.name}" enviada com sucesso!` });
            } catch (err: any) {
                console.error("UPLOAD ERROR", err);

                // mark as error
                setUploadingKeys((prev) => ({ ...prev, [index]: "ERROR" }));

                setToast({ type: "error", message: `Erro ao enviar "${file.name}".` });
            } finally {
                setTimeout(() => setToast(null), 3000);
            }
        }
    };

    function openFilePicker() {
        fileInputRef.current?.click();
    }

    // remove one file
    function removeFile(index: number) {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setThumbUrls((prev) => {
            const url = prev[index];
            if (url) URL.revokeObjectURL(url);
            return prev.filter((_, i) => i !== index);
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    // upload a single file using user's helper; keep track of progress
    async function uploadFileAtIndex(file: File, index: number) {
        try {
            // mark uploading (already set above, but safe)
            setUploadingKeys((s) => ({ ...s, [index]: null }));

            const key = await uploadFullMenuImageAI(file); // returns key

            const publicUrl =
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/full-menu-images-ai/` +
                encodeURIComponent(key);

            // Mark upload done (store key)
            setUploadingKeys((s) => ({ ...s, [index]: key }));

            // Put public URL exactly in the correct slot
            setUploadedUrls((prev) => {
                const updated = [...prev];
                updated[index] = publicUrl;
                return updated;
            });

            setToast({ message: "Upload OK", type: "success" });

        } catch (err: any) {
            console.error("upload error", err);

            // Mark upload as error
            setUploadingKeys((s) => ({ ...s, [index]: "ERROR" }));

            setToast({ message: "Falha no upload: " + (err?.message ?? err), type: "error" });
        } finally {
            setTimeout(() => setToast(null), 3500);
        }
    }

    // Upload all files in parallel (called when user clicks Continue)
    async function ensureAllUploaded() {
        // if already have uploadedUrls matching files length, skip uploading that file
        const uploads: Promise<void>[] = [];
        files.forEach((f, idx) => {
            // if we already have a key for this index, skip (we store keys by index)
            if (uploadingKeys[idx] && uploadingKeys[idx] !== "ERROR") {
                // already uploaded or in progress
                return;
            }
            uploads.push(
                (async () => {
                    await uploadFileAtIndex(f, idx);
                })()
            );
        });
        await Promise.all(uploads);
    }

    // call AI endpoint with uploadedUrls
    async function callAiScan(urls: string[]) {
        setIsScanning(true);

        try {
            const res = await fetch("/api/scan-menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId, urls }),
            });
            const json = await res.json();
            if (!res.ok) {
                setToast({ message: json?.error || "O Scan com IA falhou", type: "error" });
                setIsScanning(false);
                return null;
            }
            setToast({ message: "Scan com IA realizado", type: "success" });
            setTimeout(() => setToast(null), 3000);
            return json as ScannedResult;
        } catch (err: any) {
            console.error(err);
            setToast({ message: "AI scan error: " + (err?.message ?? err), type: "error" });
            return null;
        } finally {
            setIsScanning(false);
        }
    }

    // User clicks Continue: upload then call AI
    async function handleContinue() {
        if (files.length === 0) {
            setToast({ message: "Adicione ao menos 1 foto", type: "error" });
            setTimeout(() => setToast(null), 2500);
            return;
        }
        const anyUploading = Object.values(uploadingKeys).some(v => v === null);
        if (anyUploading) {
            setToast({ message: "Aguarde: imagens ainda estão sendo enviadas.", type: "error" });
            setTimeout(() => setToast(null), 2500);
            return;
        }

        // 1. ensure uploads
        setIsScanning(true);
        await ensureAllUploaded();

        // small check: build publicUrls for all uploaded keys
        // NOTE: we appended publicUrls in uploadFileAtIndex so uploadedUrls len should match
        // but ensure we have them now
        const publicUrls = uploadedUrls.slice(0, files.length);

        // fallback: if user helper returned keys in uploadingKeys map, build urls from keys
        if (publicUrls.length < files.length) {
            const fallbackUrls: string[] = [];
            files.forEach((_, idx) => {
                const key = uploadingKeys[idx];
                if (key && key !== "ERROR") {
                    fallbackUrls.push(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/full-menu-images-ai/${encodeURIComponent(key)}`);
                }
            });
            // merge preserving order: prefer publicUrls then fallback
            while (publicUrls.length < files.length && fallbackUrls.length) {
                publicUrls.push(fallbackUrls.shift()!);
            }
        }

        if (publicUrls.length === 0) {
            setToast({ message: "Aguarde alguns segundos e tente novamente (imagens carregando).", type: "error" });
            setIsScanning(false);
            return;
        }

        // 2. call AI
        const aiRes = await callAiScan(publicUrls);
        if (!aiRes) {
            setIsScanning(false);
            return;
        }

        // 3. normalize results and prepare category mapping state
        setScanResult(aiRes);

        // Initialize categoryMap (AI categories -> not mapped)
        const aiCats = (aiRes.categories || []).map((c) => c.name);
        const newMap: Record<string, { mappedId: string | null; createNew: boolean }> = {};
        aiCats.forEach((name) => {
            newMap[name] = { mappedId: null, createNew: true };
        });
        setCategoryMap(newMap);

        setIsScanning(false);
    }

    // Save flow: create categories for those still requiring creation, then create items
    async function handleSaveAll() {
        if (!scanResult) return;
        setIsSaving(true);


        try {
            // 1. Determine which categories need creation (those with createNew true OR mappedId null)
            const entries = Object.entries(categoryMap);
            const createPromises: Promise<{ name: string; id: string }>[] = [];

            for (const [catName, cfg] of entries) {
                if (cfg.mappedId) continue; // already mapped to existing id
                if (cfg.createNew) {
                    // create category
                    createPromises.push((async () => {
                        const res = await fetch("/api/categories/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ restaurant_id: restaurantId, name: catName, position: 0 }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error || "create category failed");
                        // json.category is the created category row (expects id)
                        return { name: catName, id: json.category.id };
                    })());
                }
            }

            const created = await Promise.all(createPromises).catch((err) => {
                throw err;
            });

            // update categoryMap with created ids
            const newMap = { ...categoryMap };
            created.forEach((c) => {
                newMap[c.name] = { mappedId: c.id, createNew: false };
            });

            // 2. create items (use mapped category ids)
            const createItemPromises: Promise<any>[] = [];
            scanResult.items.forEach((it, idx) => {
                // determine category id
                const catName = it.category_name ?? "Uncategorized";
                const mapping = newMap[catName];
                const category_id = mapping?.mappedId ?? null;

                if (!category_id) {
                    // if still no category_id, create a category on the fly
                    // (shouldn't happen if we created above) — fallback
                    createItemPromises.push((async () => {
                        const createCatRes = await fetch("/api/categories/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ restaurant_id: restaurantId, name: catName, position: 0 }),
                        });
                        const createCatJson = await createCatRes.json();
                        const newCatId = createCatJson.category.id;
                        // then create item
                        const res = await fetch("/api/items/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                restaurant_id: restaurantId,
                                category_id: newCatId,
                                name: it.name,
                                description: it.description,
                                price_cents: it.price_cents ?? 0,
                                image_path: it.image_path ?? null,
                                position: idx,
                            }),
                        });
                        return res.json();
                    })());
                } else {
                    // create item with mapped category
                    createItemPromises.push(
                        fetch("/api/items/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                restaurant_id: restaurantId,
                                category_id,
                                name: it.name,
                                description: it.description,
                                price_cents: it.price_cents ?? 0,
                                image_path: it.image_path ?? null,
                                position: idx,
                            }),
                        }).then((r) => r.json())
                    );
                }

            });

            const createdItems = await Promise.all(createItemPromises);

            setToast({ message: "Salvo com sucesso", type: "success" });
            setTimeout(() => setToast(null), 2500);

            // done: close modal or reset
            onClose();
        } catch (err: any) {
            console.error(err);
            setToast({ message: "Erro ao salvar: " + (err?.message ?? err), type: "error" });
            setTimeout(() => setToast(null), 4000);
        } finally {
            onRefresh()
            setIsSaving(false);
        }
    }

    // UI helpers
    const aiCategories = useMemo(() => (scanResult?.categories || []).map((c) => c.name), [scanResult]);
    const itemsGrouped = useMemo(() => {
        const res: Record<string, ScannedItem[]> = {};
        (scanResult?.items || []).forEach((it) => {
            const cat = it.category_name ?? "_uncategorized";
            res[cat] = res[cat] || [];
            res[cat].push(it);
        });
        return res;
    }, [scanResult]);

    // change mapping for one category
    function handleMapCategory(catName: string, mappedId: string | null, createNew = false) {
        setCategoryMap((m) => ({ ...m, [catName]: { mappedId, createNew } }));
    }

    // minimal camera support: open file input with accept capture (mobile)
    function openCamera() {
        const el = document.createElement("input");
        el.type = "file";
        el.accept = "image/*";
        // @ts-ignore
        el.capture = "environment";
        el.onchange = async (e: any) => {
            await handleFilesSelected(e.target.files);
        };
        el.click();
    }



    return (
        <>
            <Modal open={open} onClose={onClose}>
                <div className="p-6 w-full max-w-3xl overflow-y-auto">

                    {/* Step 1: upload area */}
                    {!scanResult && (
                        <div className="space-y-6">
                            <div className=" rounded-lg p-4">
                                <div className={"mb-6"}>
                                    <p className="font-semibold">Adicione seu Cardápio</p>
                                    <p className="text-sm text-gray-500">JPG, PNG, PDF. <b>Use os arquivos de imagem do seu cardápio para melhores resultados.</b></p>
                                </div>

                                <div className="flex items-center justify-between gap-8">

                                    <div className="flex gap-2 mb-4">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*,.pdf"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                if (!e.target.files) return;
                                                handleFilesSelected(e.target.files);
                                            }}                                        />
                                        <Button variant="secondary" onClick={openFilePicker}>
                                            Adicionar fotos
                                        </Button>
                                        <Button variant="secondary" onClick={openCamera}>
                                            Abrir câmera
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 mb-6">
                                    {/* Thumbnails row */}
                                    <div className="flex gap-3 overflow-x-auto pb-2">
                                        {thumbUrls.map((u, i) => (
                                            <div key={i} className="relative w-28 h-28 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                {uploadingKeys[i] === null && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                        <Loader />
                                                    </div>
                                                )}
                                                <img src={u} className="w-full h-full object-cover" alt={`thumb-${i}`} />
                                                <button
                                                    onClick={() => removeFile(i)}
                                                    className="cursor-pointer absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                                                >
                                                    ✕
                                                </button>

                                                <div className="absolute left-1 bottom-1 text-xs bg-white/80 px-1 rounded">
                                                    {uploadingKeys[i] === undefined ? "—" : uploadingKeys[i] === null ? "..." : uploadingKeys[i] === "ERROR" ? "ERRO" : <FontAwesomeIcon icon={icons.faCheck} />}
                                                </div>
                                            </div>
                                        ))}

                                        {/* add more placeholder */}
                                        <div
                                            onDragOver={(e) => {e.preventDefault(); setIsDraggingImage(true)}}
                                            onDragLeave={(e) => {e.preventDefault(); setIsDraggingImage(false)}}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDraggingImage(false)
                                                if (!e.dataTransfer.files) return;
                                                handleFilesSelected(e.dataTransfer.files);
                                            }}
                                            className={`rounded-lg border-dashed border-2   flex items-center justify-center flex-shrink-0
                                    ${files.length === 0 ? "w-full h-38" : "w-28 h-28"}
                                    ${isDraggingImage ? "border-brand text-brand" : "border-gray-300 text-gray-500"}`}
                                        >
                                            <button
                                                onClick={openFilePicker}
                                                className="w-full h-full text-sm cursor-pointer"
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
                                <Button variant="primary" onClick={handleContinue} loading={isScanning}>
                                    Continuar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: show result grouped by category + mapping */}
                    {scanResult && (
                        <div className="space-y-6 ">
                            {/* ========================= */}
                            {/* AI categories with mapping dropdown + items BELOW */}
                            {/* ========================= */}

                            <div className="space-y-6">
                                {aiCategories.map((catName) => {
                                    const mapping = categoryMap[catName] ?? { mappedId: null, createNew: true };

                                    const dropdownOptions = [
                                        { value: "__create_new__", label: `Criar nova categoria (“${catName}”)` },
                                        ...existingCategories.map((c) => ({ value: c.id, label: c.name })),
                                    ];

                                    const items = itemsGrouped[catName] ?? [];

                                    return (
                                        <div key={catName} className="bg-white p-4 rounded-lg shadow-sm">
                                            {/* Row: category title + dropdown */}
                                            <div className="flex items-start justify-between gap-4 mb-6 ">
                                                <div className="flex-1">
                                                    <div className="text-sm text-gray-500">Categoria detectada</div>
                                                    <div className="font-semibold text-lg">{catName}</div>
                                                </div>

                                                <div className="w-[320px]">
                                                    <Dropdown
                                                        label="Mapear para"
                                                        value={mapping.mappedId ?? "__create_new__"}
                                                        options={dropdownOptions}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === "__create_new__") handleMapCategory(catName, null, true);
                                                            else handleMapCategory(catName, val, false);
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Items for this AI category */}
                                            <div className="space-y-3">
                                                {items.length === 0 ? (
                                                    <div className="text-sm text-gray-500">Nenhum item detectado nesta categoria.</div>
                                                ) : (
                                                    items.map((it, i) => (
                                                        <div key={i} className="flex gap-4 items-start">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-base">{it.name}</div>
                                                                <div className="text-sm text-gray-600 mt-1">{it.description}</div>
                                                                <div className="text-sm font-semibold mt-2">
                                                                    {typeof it.price_cents === "number" && it.price_cents >= 0
                                                                        ? `R$ ${(it.price_cents / 100).toFixed(2).replace(".", ",")}`
                                                                        : "—"}
                                                                </div>
                                                            </div>

                                                            <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                                                {it.image_path ? (
                                                                    <img
                                                                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/full-menu-images-ai/${it.image_path}`}
                                                                        className="w-full h-full object-cover"
                                                                        alt={it.name}
                                                                    />
                                                                ) : (
                                                                    <img src="/placeholders/item.png" alt="no image" />
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
                                <Button variant="secondary" onClick={() => { setScanResult(null); setFiles([]); setThumbUrls([]); }}>
                                    Voltar
                                </Button>
                                <Button variant="primary" onClick={handleSaveAll} loading={isSaving}>
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Loading indicator (top) */}
                    {isScanning && (
                        <div className="mt-4">
                            <LoadingBar key={String(isScanning)} durationSeconds={13} showLabel={true} />
                        </div>
                    )}
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
}

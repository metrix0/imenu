"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { faChevronRight, faFilm, faImage, faSpinner } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import SaveStatus from "@/components/ui/SaveStatus";
import { icons } from "@/lib/utils/fontawesome";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";
import { copyCoverToGallery, uploadMenuImage } from "@/lib/database/uploadMenuImage";
import { uploadMenuVideo } from "@/lib/database/uploadMenuVideo";
import { getMenuItemImageUrl, MENU_GALLERY_IMAGE_PREFIX } from "@/lib/menu/itemImages";
import { MAX_ITEM_MEDIA, MENU_VIDEO_TYPES, getPublicItemMedia, readItemMedia, type ItemMedia } from "@/lib/menu/itemMedia";
import type { MenuItemSettingsUpdate, MenuItemType } from "./MenuItemRow";

type Slots = (ItemMedia | null)[];
const mediaControl = "h-7 w-7 cursor-pointer rounded text-gray-500 disabled:cursor-default disabled:opacity-30";

function movedMedia(media: Slots, from: number, to: number): Slots | null {
    if (from === to || to < 0 || to >= media.length || !media[from] || !media[to]) return null;
    const next = [...media];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next[0]?.type === "image" ? next : null;
}

export default function ItemMediaSettings({ item, restaurantId, onUpdated, onBusyChange }: {
    item: MenuItemType;
    restaurantId: string;
    onUpdated: (item: MenuItemSettingsUpdate) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [media, setMedia] = useState<Slots>(() => [
        item.image_path ? { type: "image", path: item.image_path } : null,
        ...readItemMedia(item.gallery_media),
    ]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInput = useRef<HTMLInputElement>(null);
    const dragged = useRef<number | null>(null);
    const copiedCovers = useRef(new Map<string, string>());
    const saved = useRef({ image_path: item.image_path ?? null, gallery_media: item.gallery_media ?? [] });
    const save = useAutoSave<Slots>(`${restaurantId}:${item.id}:gallery`, async next => {
        const cover = next[0];
        const imagePath = cover ? copiedCovers.current.get(cover.path) ?? cover.path : null;
        const gallery = await Promise.all(next.slice(1)
            .filter((entry): entry is ItemMedia => entry !== null)
            .map(async entry => {
                if (entry.type !== "image") return entry;
                const path = copiedCovers.current.get(entry.path) ?? await copyCoverToGallery(entry.path, restaurantId);
                if (path !== entry.path) copiedCovers.current.set(entry.path, path);
                return { ...entry, path };
            }));
        const update = { image_path: imagePath, gallery_media: gallery };
        const previous = saved.current;
        const query = supabase.from("items").update(update)
            .eq("id", item.id).eq("restaurant_id", restaurantId)
            .eq("gallery_media", JSON.stringify(previous.gallery_media));
        const guarded = previous.image_path === null
            ? query.is("image_path", null)
            : query.eq("image_path", previous.image_path);
        const { error } = await guarded.select("id").single();
        if (error) throw new Error("Não foi possível salvar as mídias. Se o item foi alterado em outra aba, reabra as configurações.");
        saved.current = update;
        setMedia(current => current.map(entry => {
            if (!entry) return entry;
            const path = copiedCovers.current.get(entry.path);
            return path ? { ...entry, path } : entry;
        }));
        onUpdated({ id: item.id, ...update, image_url: getMenuItemImageUrl(supabase, imagePath) });
    });

    const isBusy = uploading || save.status === "saving";
    useEffect(() => { onBusyChange(isBusy); }, [isBusy, onBusyChange]);

    const uploadSlot = media[0] ? media.length : 0;
    const canUpload = uploadSlot < MAX_ITEM_MEDIA;
    const acceptsVideo = uploadSlot > 0 && !media.some(entry => entry?.type === "video");
    const canRemoveCover = media.length === 1 || media.slice(1).some(entry => entry?.type === "image");

    const changeMedia = (next: Slots) => {
        setMedia(next);
        save.schedule(next);
    };

    const move = (from: number, to: number) => {
        const next = movedMedia(media, from, to);
        if (next) changeMedia(next);
    };

    const upload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || uploading || !canUpload) return;
        const isVideo = file.type.startsWith("video/");
        if (isVideo && !acceptsVideo) {
            setUploadError("Adicione a foto principal antes do vídeo. Cada item pode ter um vídeo.");
            return;
        }
        if (!isVideo && !file.type.startsWith("image/")) {
            setUploadError("Escolha uma imagem.");
            return;
        }

        setUploadError("");
        setUploading(true);
        try {
            const path = isVideo
                ? await uploadMenuVideo(file, restaurantId)
                : await uploadMenuImage(file, restaurantId, MENU_GALLERY_IMAGE_PREFIX);
            const next = [...media];
            next[uploadSlot] = { type: isVideo ? "video" : "image", path };
            changeMedia(next);
        } catch (error) {
            setUploadError(isVideo && error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
        } finally {
            setUploading(false);
        }
    };

    const remove = (index: number) => {
        if (index > 0) {
            changeMedia(media.filter((_, position) => position !== index));
            return;
        }
        const nextCover = media.findIndex((entry, position) => position > 0 && entry?.type === "image");
        if (nextCover === -1) {
            if (media.length === 1) changeMedia([null]);
            return;
        }
        changeMedia([media[nextCover], ...media.filter((_, position) => position > 0 && position !== nextCover)]);
    };

    return (
        <section aria-label="Mídias do item" className="space-y-2">
            <SaveStatus status={uploading ? "saving" : save.status} />
            <h3 className="text-sm font-medium text-gray-900">Mídias <span className="ml-1 font-normal text-gray-500">{media.filter(Boolean).length}/{MAX_ITEM_MEDIA}</span></h3>
            <input
                ref={fileInput}
                type="file"
                className="hidden"
                aria-label="Enviar mídia"
                accept={acceptsVideo ? `image/*,${MENU_VIDEO_TYPES.join(",")}` : "image/*"}
                onChange={upload}
            />
            <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: MAX_ITEM_MEDIA }, (_, index) => {
                    const entry = media[index];
                    const label = index === 0 ? "Foto principal" : `Mídia ${index + 1}`;
                    const canRemove = index > 0 || canRemoveCover;
                    return (
                        <div key={index} className="min-w-0">
                            <div
                                draggable={Boolean(entry) && !uploading}
                                onDragStart={event => {
                                    event.stopPropagation();
                                    dragged.current = index;
                                    event.dataTransfer.setData("text/plain", String(index));
                                    event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={event => {
                                    if (dragged.current === null || uploading || !movedMedia(media, dragged.current, index)) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                }}
                                onDragEnd={event => { event.stopPropagation(); dragged.current = null; }}
                                onDrop={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (dragged.current !== null && !uploading) move(dragged.current, index);
                                    dragged.current = null;
                                }}
                                className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100 text-gray-500 ${entry && !uploading ? "cursor-grab active:cursor-grabbing" : ""}`}
                            >
                                {entry?.type === "image" && <img src={getMenuItemImageUrl(supabase, entry.path) ?? undefined} alt={label} draggable={false} className="h-full w-full object-cover" />}
                                {entry?.type === "video" && (
                                    <>
                                        <video src={getPublicItemMedia(supabase, [entry])[0]?.url} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
                                        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"><PanelIcon icon={faFilm} /> Vídeo</span>
                                    </>
                                )}
                                {!entry && index === uploadSlot && canUpload && (
                                    <button type="button" aria-label={index === 0 ? "Adicionar foto principal" : "Adicionar mídia"} disabled={uploading} onClick={() => fileInput.current?.click()} className="grid h-full w-full cursor-pointer place-items-center hover:bg-gray-200 disabled:cursor-wait">
                                        <PanelIcon icon={uploading ? faSpinner : icons.faPlus} className={uploading ? "animate-spin text-brand" : ""} />
                                    </button>
                                )}
                                {!entry && index !== uploadSlot && <PanelIcon icon={faImage} className="text-gray-300" />}
                            </div>
                            {entry && (
                                <div className="mt-1 flex items-center justify-between gap-1">
                                    {[-1, 1].map(direction => {
                                        const side = direction < 0 ? "esquerda" : "direita";
                                        return (
                                            <button
                                                type="button"
                                                key={direction}
                                                title={`Mover para a ${side}`}
                                                aria-label={`Mover ${label} para a ${side}`}
                                                disabled={uploading || !movedMedia(media, index, index + direction)}
                                                onClick={() => move(index, index + direction)}
                                                className={`${mediaControl} hover:bg-gray-100`}
                                            >
                                                <PanelIcon icon={direction < 0 ? icons.faChevronLeft : faChevronRight} className="text-xs" />
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        title={canRemove ? "Remover mídia" : "Remova o vídeo primeiro ou adicione outra foto"}
                                        aria-label={`Remover ${label}`}
                                        disabled={uploading || !canRemove}
                                        onClick={() => remove(index)}
                                        className={`${mediaControl} hover:text-red-600`}
                                    >
                                        <PanelIcon icon={icons.faTrash} className="text-xs" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="text-xs text-gray-500">A primeira mídia é a foto principal.{acceptsVideo && canUpload ? " Vídeo de até 30 s e 12 MB." : ""}</p>
            {uploadError && <p role="alert" className="text-sm text-red-600">{uploadError}</p>}
            {save.error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-red-600">{save.error}</p><Button variant="secondary" onClick={() => save.retry()} disabled={uploading}>Tentar novamente</Button></div>}
        </section>
    );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ToggleOptionCard from "@/components/ui/ToggleOptionCard";
import SaveStatus from "@/components/ui/SaveStatus";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import Toast from "@/components/ui/Toast";
import type { MenuItemSettingsUpdate, MenuItemType } from "./MenuItemRow";
import ItemMediaSettings from "./ItemMediaSettings";
import AvailabilityScheduleEditor, { useAvailabilityScheduleEditor } from "./AvailabilityScheduleEditor";
import type { CategorySchedule } from "@/lib/menu/categorySchedule";

type Availability = {
    available_for_delivery: boolean;
    available_for_salao: boolean;
    availability_schedule: CategorySchedule;
};

export default function ItemSettingsModal({ item, restaurantId, open, onClose, onUpdated, onOpenComplements }: {
    item: MenuItemType;
    restaurantId: string;
    open: boolean;
    onClose: () => void;
    onUpdated: (item: MenuItemSettingsUpdate) => void;
    onOpenComplements?: () => void;
}) {
    const restaurantSlug = useCreationStore(state => state.restaurantSlug);
    const setRestaurantSlug = useCreationStore(state => state.setRestaurantSlug);
    const [availability, setAvailability] = useState<Availability>({
        available_for_delivery: item.available_for_delivery !== false,
        available_for_salao: item.available_for_salao !== false,
        availability_schedule: item.availability_schedule ?? null,
    });
    const [mediaBusy, setMediaBusy] = useState(false);
    const [plusActive, setPlusActive] = useState<boolean | null>(null);
    const [plusSalesOpen, setPlusSalesOpen] = useState(false);
    const [plusAccessError, setPlusAccessError] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState("");
    const loadPlusAccess = useCallback(async (signal?: AbortSignal) => {
        setPlusAccessError(false);
        try {
            const response = await qrTableAuthenticatedFetch(
                `/api/addons/billing?restaurantId=${encodeURIComponent(restaurantId)}`,
                { cache: "no-store", signal },
            );
            if (!response.ok) throw new Error("Não foi possível verificar o iMenu Plus.");
            const { addons } = await response.json() as {
                addons?: Array<{ addon: { product_key: string }; active: boolean }>;
            };
            if (!signal?.aborted) {
                setPlusActive(addons?.some(({ addon, active }) => addon.product_key === "ia_plus" && active) === true);
            }
        } catch {
            if (!signal?.aborted) {
                setPlusActive(null);
                setPlusAccessError(true);
            }
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!open || !restaurantId) return;
        const controller = new AbortController();
        setPlusActive(null);
        void loadPlusAccess(controller.signal);
        return () => controller.abort();
    }, [open, restaurantId, loadPlusAccess]);

    const save = useAutoSave<Availability>(`${restaurantId}:${item.id}`, async value => {
        const { data, error } = await supabase.from("items").update(value)
            .eq("id", item.id).eq("restaurant_id", restaurantId)
            .select("available_for_delivery, available_for_salao, availability_schedule").single();
        if (error || !data) throw new Error("Não foi possível salvar a disponibilidade.");
        onUpdated({ id: item.id, ...data });
    });
    const updateAvailability = (change: Partial<Availability>) => {
        const next = { ...availability, ...change };
        setAvailability(next);
        save.schedule(next);
    };
    const scheduleEditor = useAvailabilityScheduleEditor(item.availability_schedule, schedule => {
        updateAvailability({ availability_schedule: schedule });
    });
    const copyLink = async () => {
        setCopyError("");
        try {
            let slug = restaurantSlug;
            if (!slug) {
                const { data, error } = await supabase.from("restaurants").select("url_slug").eq("id", restaurantId).single();
                if (error || !data?.url_slug) throw new Error("Não foi possível copiar o link.");
                slug = String(data.url_slug);
                setRestaurantSlug(slug);
            }
            await navigator.clipboard.writeText(`imenuapp.com.br/${slug}/?p=${item.id}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopyError("Não foi possível copiar o link.");
        }
    };

    const isBusy = mediaBusy || save.status === "saving";

    return <>
        <SaveStatus status={scheduleEditor.scheduleError && save.status !== "saving" ? "error" : save.status} />
        <Modal height={680} open={open} onClose={() => { if (!isBusy && !plusSalesOpen) onClose(); }} bodyClassName="[scrollbar-gutter:stable]" showCloseButton>
            <div className="space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pr-10">
                    <div className="min-w-0 flex-[1_1_7.5rem]">
                        <h2 className="text-xl font-semibold text-gray-900">Configurações do item</h2>
                        <p className="mt-1 break-words text-sm text-gray-500">{item.name}</p>
                    </div>
                    <Button variant="secondary" onClick={() => void copyLink()} className="shrink-0 gap-2 whitespace-nowrap">
                        <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faLink} />
                        {copied ? "Link copiado" : "Copiar link do item"}
                    </Button>
                    {copyError && <p role="alert" className="w-full text-sm text-red-600">{copyError}</p>}
                </div>
                <ItemMediaSettings item={item} restaurantId={restaurantId} onUpdated={onUpdated} onBusyChange={setMediaBusy}
                    plusActive={plusActive} onOpenPlus={() => setPlusSalesOpen(true)} />
                <section className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900">Disponibilidade</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                        <ToggleOptionCard
                            label="Disponível para delivery"
                            ariaLabel="Disponível para delivery"
                            checked={availability.available_for_delivery}
                            onChange={(checked) => updateAvailability({ available_for_delivery: checked })}
                            className="text-sm"
                        />
                        <ToggleOptionCard
                            label="Disponível para salão"
                            ariaLabel="Disponível para salão"
                            checked={availability.available_for_salao}
                            onChange={(checked) => updateAvailability({ available_for_salao: checked })}
                            className="text-sm"
                        />
                    </div>
                    <AvailabilityScheduleEditor editor={scheduleEditor} subject="do item" />
                </section>
                {save.error && <p role="alert" className="text-sm text-red-600">{save.error}</p>}
                <p className="text-sm text-gray-500">
                    Quer adicionar opções ao produto?{" "}
                    <button type="button" disabled={isBusy} onClick={() => { onClose(); onOpenComplements?.(); }} className="cursor-pointer font-medium text-brand hover:underline disabled:opacity-50">Acesse Complementos.</button>
                </p>
            </div>
        </Modal>
        {plusSalesOpen && <IaPlusSalesModal
            open
            onClose={() => setPlusSalesOpen(false)}
            restaurantId={restaurantId}
            contextFeature="menu_media"
            contextMessage="Com o iMenu Plus, você pode adicionar mais de uma foto e um vídeo aos itens do cardápio."
            onPaid={async () => {
                setPlusSalesOpen(false);
                await loadPlusAccess();
            }}
        />}
        {plusAccessError && <Toast type="error" message="Não foi possível verificar o iMenu Plus." />}
    </>;
}

"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import type { MenuItemType } from "./MenuItemRow";

type Availability = { available_for_delivery: boolean; available_for_salao: boolean };

export default function ItemSettingsModal({ item, restaurantId, open, onClose, onUpdated, onOpenComplements }: {
    item: MenuItemType;
    restaurantId: string;
    open: boolean;
    onClose: () => void;
    onUpdated: (item: MenuItemType) => void;
    onOpenComplements?: () => void;
}) {
    const restaurantSlug = useCreationStore(state => state.restaurantSlug);
    const setRestaurantSlug = useCreationStore(state => state.setRestaurantSlug);
    const [availability, setAvailability] = useState<Availability>({
        available_for_delivery: item.available_for_delivery !== false,
        available_for_salao: item.available_for_salao !== false,
    });
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState("");
    const save = useAutoSave<Availability>(`${restaurantId}:${item.id}`, async value => {
        const { data, error } = await supabase.from("items").update(value)
            .eq("id", item.id).eq("restaurant_id", restaurantId)
            .select("available_for_delivery, available_for_salao").single();
        if (error || !data) throw new Error("Não foi possível salvar a disponibilidade.");
        onUpdated({ ...item, ...data });
    });
    const update = (field: keyof Availability) => {
        const next = { ...availability, [field]: !availability[field] };
        setAvailability(next);
        save.schedule(next);
    };
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

    return <>
        <SaveStatus status={save.status} />
        <Modal height={420} open={open} onClose={() => { if (save.status !== "saving") onClose(); }} showCloseButton>
            <div className="space-y-5 p-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Configurações do item</h2>
                    <p className="mt-1 text-sm text-gray-500">{item.name}</p>
                </div>
                <Button variant="secondary" onClick={() => void copyLink()} className="gap-2">
                    <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faLink} />
                    {copied ? "Link copiado" : "Copiar link do item"}
                </Button>
                {copyError && <p role="alert" className="text-sm text-red-600">{copyError}</p>}
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <span id={`delivery-${item.id}`} className="text-sm font-medium text-gray-900">Disponível para delivery</span>
                        <Switch checked={availability.available_for_delivery} onClick={() => update("available_for_delivery")} aria-labelledby={`delivery-${item.id}`} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span id={`salao-${item.id}`} className="text-sm font-medium text-gray-900">Disponível para salão</span>
                        <Switch checked={availability.available_for_salao} onClick={() => update("available_for_salao")} aria-labelledby={`salao-${item.id}`} />
                    </div>
                </div>
                {save.error && <p role="alert" className="text-sm text-red-600">{save.error}</p>}
                <p className="text-sm text-gray-500">
                    Quer adicionar opções ao produto?{" "}
                    <button type="button" disabled={save.status === "saving"} onClick={() => { onClose(); onOpenComplements?.(); }} className="cursor-pointer font-medium text-brand hover:underline disabled:opacity-50">Acesse Complementos.</button>
                </p>
            </div>
        </Modal>
    </>;
}

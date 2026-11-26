"use client";
import { useCallback, useEffect, useState } from "react";
import ConfigurationCard from "@/components/ui/ConfigurationCard";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import SaveStatus from "@/components/ui/SaveStatus";
import { supabase } from "@/lib/database/supabaseClient";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { DEFAULT_MOBILE_PRINT, parseMobilePrintSettings, RECEIPT_FIELDS, SAMPLE_RECEIPT, type MobilePrintSettings } from "@/lib/printer/mobileReceipt";
import { downloadReceipt } from "@/components/restaurant-owner/pedidos/MobilePrintButton";

export default function MobilePrintSettingsSection({ restaurantId }: { restaurantId: string }) {
    const [settings, setSettings] = useState(DEFAULT_MOBILE_PRINT);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState("");
    const save = useCallback(async (next: MobilePrintSettings) => {
        const { data, error } = await supabase.from("restaurants").update({ mobile_print_settings: next })
            .eq("id", restaurantId).select("id").single();
        if (error || !data) throw new Error("Não foi possível salvar a impressão pelo celular.");
    }, [restaurantId]);
    const autosave = useAutoSave(restaurantId, save);
    useEffect(() => {
        let active = true;
        void supabase.from("restaurants").select("mobile_print_settings").eq("id", restaurantId).single().then(({ data, error }) => {
            if (!active) return;
            if (error || !data) { setLoadError("Não foi possível carregar a impressão pelo celular."); return; }
            setSettings(parseMobilePrintSettings(data.mobile_print_settings)); setLoaded(true);
        });
        return () => { active = false; };
    }, [restaurantId]);
    const update = (next: MobilePrintSettings) => {
        setSettings(next); autosave.schedule(next);
    };
    const sizes = [{ value: "normal", label: "Normal" }, { value: "large", label: "Grande" }];
    const extendedSizes = [...sizes, { value: "extra", label: "Extra grande" }];
    return <ConfigurationCard
        title="Modo Impressão pelo Celular (não recomendado)"
        description="Somente para restaurantes sem computador Windows. Recomendamos o iMenu Impressora para impressão automática."
        checked={settings.enabled} onChange={enabled => update({ ...settings, enabled })}
        disabled={!loaded} collapse={{ defaultOpen: false }}
        footer={<>
            {!loaded && !loadError && <ListLoader lines={2} />}
            {loadError && <p role="alert" className="mt-2 text-sm text-red-700">{loadError}</p>}
            {autosave.error && <p role="alert" className="mt-2 text-sm text-red-700">{autosave.error} <button type="button" className="underline" onClick={autosave.retry}>Tentar novamente</button></p>}
            <SaveStatus status={autosave.status} />
        </>}
    >
        <p className="text-sm text-gray-600">Ao ativar, use o botão de impressão nos pedidos para baixar a comanda em PDF. Abra o arquivo no aplicativo compatível com sua impressora. Não há impressão automática pelo celular.</p>
        {loaded && <fieldset className="space-y-4" disabled={!settings.enabled}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Dropdown custom label="Largura do papel" value={settings.paper} onChange={e => update({ ...settings, paper: e.target.value as MobilePrintSettings["paper"] })}
                    options={[{ value: "58", label: "58 mm" }, { value: "80", label: "80 mm" }, { value: "a4", label: "A4" }]} />
                <Dropdown custom label="Espaçamento" value={settings.spacing} onChange={e => update({ ...settings, spacing: e.target.value as MobilePrintSettings["spacing"] })}
                    options={[{ value: "compact", label: "Compacto" }, { value: "normal", label: "Normal" }, { value: "spacious", label: "Espaçoso" }]} />
                <Input label="Título da comanda" value={settings.title} maxLength={24} onChange={e => update({ ...settings, title: e.target.value })} />
                <Input label="Texto no final" value={settings.footer} maxLength={120} onChange={e => update({ ...settings, footer: e.target.value })} />
                <Dropdown custom label="Tamanho do texto" value={settings.textSize} options={sizes} onChange={e => update({ ...settings, textSize: e.target.value as MobilePrintSettings["textSize"] })} />
                <Dropdown custom label="Número do pedido" value={settings.orderSize} options={extendedSizes} onChange={e => update({ ...settings, orderSize: e.target.value as MobilePrintSettings["orderSize"] })} />
                <Dropdown custom label="Itens" value={settings.itemSize} options={sizes} onChange={e => update({ ...settings, itemSize: e.target.value as MobilePrintSettings["itemSize"] })} />
                <Dropdown custom label="Total" value={settings.totalSize} options={extendedSizes} onChange={e => update({ ...settings, totalSize: e.target.value as MobilePrintSettings["totalSize"] })} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(RECEIPT_FIELDS) as (keyof typeof RECEIPT_FIELDS)[]).map(field =>
                    <label key={field} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm">
                        <input type="checkbox" className="h-4 w-4 accent-brand" checked={settings[field]} onChange={e => update({ ...settings, [field]: e.target.checked })} />
                        {RECEIPT_FIELDS[field]}
                    </label>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => downloadReceipt(SAMPLE_RECEIPT, settings, "comanda-teste.pdf")}>Baixar comanda de teste</Button>
                <Button type="button" variant="secondary" onClick={() => update({ ...DEFAULT_MOBILE_PRINT, enabled: settings.enabled })}>Restaurar padrão</Button>
            </div>
        </fieldset>}
    </ConfigurationCard>;
}

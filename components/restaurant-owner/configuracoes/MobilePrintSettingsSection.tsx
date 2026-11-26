"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfigurationCard from "@/components/ui/ConfigurationCard";
import Badge from "@/components/ui/Badge";
import Tooltip from "@/components/ui/Tooltip";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import SaveStatus from "@/components/ui/SaveStatus";
import { supabase } from "@/lib/database/supabaseClient";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { DEFAULT_MOBILE_PRINT, layoutMobileReceipt, parseMobilePrintSettings, RECEIPT_FIELDS, SAMPLE_RECEIPT, type MobilePrintSettings } from "@/lib/printer/mobileReceipt";
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
    const preview = useMemo(() => layoutMobileReceipt(SAMPLE_RECEIPT, settings), [settings]);
    return <ConfigurationCard
        title="Modo Impressão pelo Celular"
        titleBadge={
            <span onClick={event => event.stopPropagation()}>
                <Tooltip
                    text="A impressão pelo celular é manual e depende de um aplicativo compatível com sua impressora. Use este modo apenas se não tiver um computador Windows; o iMenu Impressora imprime automaticamente."
                    position="top" size="medium" showOnClick
                    parentClassName="inline-flex items-center self-center leading-none"
                >
                    <Badge variant="notRecommended" className="gap-1 cursor-help">
                        Não recomendado
                        <PanelIcon icon={faCircleInfo} className="text-[11px] leading-none text-yellow-700" />
                    </Badge>
                </Tooltip>
            </span>
        }
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
        {loaded && <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.65fr)]">
        <fieldset className="min-w-0 space-y-4" disabled={!settings.enabled}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Dropdown custom label="Largura do papel" value={settings.paper} onChange={e => update({ ...settings, paper: e.target.value as MobilePrintSettings["paper"] })}
                    options={[{ value: "58", label: "58 mm" }, { value: "80", label: "80 mm" }, { value: "a4", label: "A4" }]} />
                <Dropdown custom label="Tamanho do texto" value={settings.textSize} options={sizes} onChange={e => update({ ...settings, textSize: e.target.value as MobilePrintSettings["textSize"] })} />
                <Input label="Título da comanda" value={settings.title} maxLength={24} onChange={e => update({ ...settings, title: e.target.value })} />
                <Input label="Texto no final" value={settings.footer} maxLength={120} onChange={e => update({ ...settings, footer: e.target.value })} />
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
        </fieldset>
        <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4" data-mobile-receipt-preview>
            <p className="mb-3 text-center text-sm font-medium text-gray-700">Prévia da comanda · {settings.paper === "a4" ? "A4" : `${settings.paper} mm`}</p>
            <div className="flex flex-col items-center gap-3">
                {preview.map((page, index) => <svg key={index} viewBox={`0 0 ${page.width} ${page.height}`} role="img"
                    aria-label={`Prévia da comanda, página ${index + 1}`} className="h-auto w-full border border-gray-200 bg-white shadow-sm"
                    style={{ maxWidth: settings.paper === "58" ? 232 : settings.paper === "80" ? 320 : 360 }}>
                    {page.lines.filter(line => line.text).map((line, lineIndex) => <text key={lineIndex}
                        x={line.x} y={line.y} fontSize={line.size} fontWeight={line.bold ? 700 : 400}
                        fontFamily="Courier New, monospace" fill="#111111" xmlSpace="preserve" textLength={line.textWidth} lengthAdjust="spacingAndGlyphs">{line.text}</text>)}
                </svg>)}
            </div>
        </div>
        </div>}
    </ConfigurationCard>;
}

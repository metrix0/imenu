"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faLocationCrosshairs } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import SaveStatus from "@/components/ui/SaveStatus";
import { fetchAddressByCEP, fetchAddressByCoordinates, fetchCoordinates } from "@/lib/api/geocoding";
import { AddressData } from "@/lib/types/types";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { supabase } from "@/lib/database/supabaseClient";
import type { GeoAddress } from "@/lib/api/geocoding";

interface Props { restaurantId: string; smallCityModeEnabled: boolean; onSmallCityModeActivated: () => void; onDone?: () => void; initialData?: Partial<AddressData>; onSubmit: (data: AddressData) => Promise<void>; onValidityChange?: (valid: boolean) => void; isLoading?: boolean; submitLabel?: string; embedded?: boolean; onBack?: () => void; }
type RequiredField = "cep" | "state" | "city" | "neighborhood" | "street" | "number";
const addressSnapshot = (value: Partial<AddressData>) => JSON.stringify([value.cep || "", value.state || "", value.city || "", value.neighborhood || "", value.street || "", value.number || "", value.complement || ""]);
const emptyAddress: AddressData = { cep: "", state: "", city: "", neighborhood: "", street: "", number: "", complement: "", latitude: null, longitude: null };

export async function saveRestaurantAddress(restaurantId: string, data: AddressData) {
    const response = await fetch(`/api/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: data, latitude: data.latitude, longitude: data.longitude }),
    });
    if (!response.ok) throw new Error("Não foi possível salvar o endereço. Tente novamente.");
}

const smallCityModeWarning = "O modo de entrega será alterado automaticamente para Entrega por Bairro. Configure os bairros e suas taxas em Tempo e Taxa.";

export function SmallCityModeConfirmModal({ open, suggested = false, isLoading, error, onClose, onConfirm }: {
    open: boolean;
    suggested?: boolean;
    isLoading: boolean;
    error?: string;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return <ConfirmModal
        open={open}
        onClose={() => { if (!isLoading) onClose(); }}
        onConfirm={onConfirm}
        title={suggested ? "Sua cidade possui CEP único?" : "Ativar Modo Cidade Pequena?"}
        description={suggested ? "Ative o Modo Cidade Pequena para facilitar o cadastro de endereços dos seus clientes." : smallCityModeWarning}
        descriptionAfter={suggested ? <>{smallCityModeWarning}{error ? ` ${error}` : ""}</> : error || undefined}
        confirmLabel="Ativar modo"
        cancelLabel={suggested ? "Agora não" : "Cancelar"}
        isLoading={isLoading}
        variant="primary"
    />;
}

export async function saveRestaurantSmallCityMode(restaurantId: string, enabled: boolean) {
    return supabase
        .from("restaurants")
        .update(enabled
            ? { small_city_mode_enabled: true, delivery_fee_mode: "neighborhood" }
            : { small_city_mode_enabled: false })
        .eq("id", restaurantId)
        .select("id, delivery_fee_mode")
        .single();
}

const cleanCep = (cep?: string | null) => (cep || "").replace(/\D/g, "");
const isCityWideCep = (address: GeoAddress | null, cep: string) => Boolean(
    address && cleanCep(address.cep) === cep && address.city?.trim() && address.state?.trim()
    && !address.street?.trim() && !address.neighborhood?.trim()
);
const suggestionKey = (restaurantId: string, cep: string) => `imenu:small-city-suggestion:${restaurantId}:${cep}`;

export default function AddressForm({ restaurantId, smallCityModeEnabled, onSmallCityModeActivated, onDone, initialData, onSubmit, onValidityChange, isLoading = false, submitLabel = "Salvar e Continuar", embedded = false, onBack }: Props) {
    const [form, setForm] = useState<AddressData>(() => ({ ...emptyAddress, ...initialData }));
    const [fetching, setFetching] = useState(false); const [error, setError] = useState(""); const [invalid, setInvalid] = useState<RequiredField[]>([]);
    const lastQueued = useRef<string | null>(addressSnapshot(form));
    const lastLookedUpCep = useRef(cleanCep(form.cep));
    const draftCep = useRef(cleanCep(form.cep));
    const lookupRevision = useRef(0);
    const lastSavedSnapshot = useRef(addressSnapshot(form));
    const lastSavedCep = useRef(["cep", "state", "city", "neighborhood", "street", "number"].every(key => String(form[key as RequiredField] ?? "").trim()) ? cleanCep(form.cep) : "");
    const lastCepAddress = useRef<GeoAddress | null>(null);
    const dismissedCeps = useRef(new Set<string>());
    const modeEnabled = useRef(smallCityModeEnabled);
    modeEnabled.current = smallCityModeEnabled;
    const [suggestedCep, setSuggestedCep] = useState<string | null>(null);
    const [activatingMode, setActivatingMode] = useState(false);
    const [activationError, setActivationError] = useState("");

    const rememberSuggestion = (cep: string) => {
        dismissedCeps.current.add(cep);
        try { localStorage.setItem(suggestionKey(restaurantId, cep), "1"); } catch { /* Keep the in-memory dismissal. */ }
    };

    const closeSuggestion = () => {
        if (suggestedCep) rememberSuggestion(suggestedCep);
        setSuggestedCep(null);
        setActivationError("");
    };

    const activateMode = async () => {
        if (!suggestedCep || activatingMode || modeEnabled.current) return;
        setActivatingMode(true);
        setActivationError("");
        try {
            const { data, error } = await saveRestaurantSmallCityMode(restaurantId, true);
            if (error || !data) throw new Error();
            rememberSuggestion(suggestedCep);
            setSuggestedCep(null);
            onSmallCityModeActivated();
        } catch {
            setActivationError("Não foi possível ativar o modo. Tente novamente.");
        } finally {
            setActivatingMode(false);
        }
    };
    useEffect(() => {
        if (!embedded && initialData) setForm((value) => ({ ...value, ...initialData }));
    }, [initialData, embedded]);
    const missing = useMemo(() => (["cep", "state", "city", "neighborhood", "street", "number"] as RequiredField[]).filter((key) => key === "cep" ? cleanCep(form.cep).length !== 8 : !String(form[key] ?? "").trim()), [form]);
    const valid = missing.length === 0;
    useEffect(() => onValidityChange?.(valid), [valid, onValidityChange]);
    const set = (key: keyof Omit<AddressData, "latitude" | "longitude">, value: string) => {
        if (key === "cep" && cleanCep(value) !== draftCep.current) {
            draftCep.current = cleanCep(value);
            lookupRevision.current++;
            lastLookedUpCep.current = "";
            setFetching(false);
            setError("");
            setSuggestedCep(null);
        }
        setForm(v => ({ ...v, [key]: value }));
        setInvalid(v => v.filter(item => item !== key));
    };
    const fieldClass = (key: RequiredField) => invalid.includes(key) ? "!border-red-500 focus:!border-red-500 focus:!ring-red-500" : "";

    const cepBlur = async (value: string) => {
        const cep = cleanCep(value);
        if (cep.length !== 8 || cep === lastLookedUpCep.current || cep !== draftCep.current) return;
        const revision = ++lookupRevision.current;
        lastLookedUpCep.current = cep;
        setFetching(true);
        setError("");
        try {
            const address = await fetchAddressByCEP(cep);
            if (revision !== lookupRevision.current || cep !== draftCep.current) return;
            if (!address) throw new Error();
            lastCepAddress.current = address;
            setForm(v => cleanCep(v.cep) !== cep ? v : ({
                ...v,
                state: address.state || "",
                city: address.city || "",
                neighborhood: address.neighborhood || "",
                street: address.street || "",
                latitude: address.latitude ?? null,
                longitude: address.longitude ?? null,
            }));
        } catch {
            if (revision === lookupRevision.current) setError("CEP não encontrado. Preencha o endereço manualmente.");
        } finally {
            if (revision === lookupRevision.current) setFetching(false);
        }
    };
    const useLocation = () => {
        if (!navigator.geolocation) return setError("Geolocalização não suportada.");
        const revision = ++lookupRevision.current;
        setFetching(true);
        setError("");
        navigator.geolocation.getCurrentPosition(async ({ coords }) => {
            try {
                const address = await fetchAddressByCoordinates(coords.latitude, coords.longitude);
                if (revision !== lookupRevision.current) return;
                if (!address) throw new Error();
                draftCep.current = cleanCep(address.cep);
                lastLookedUpCep.current = draftCep.current;
                lastCepAddress.current = null;
                setForm(v => ({ ...v, ...address, cep: address.cep || "", state: address.state || "", city: address.city || "", neighborhood: address.neighborhood || "", street: address.street || "", number: address.number || v.number, latitude: coords.latitude, longitude: coords.longitude }));
            } catch {
                if (revision === lookupRevision.current) setError("Não foi possível obter o endereço completo.");
            } finally {
                if (revision === lookupRevision.current) setFetching(false);
            }
        }, () => {
            if (revision !== lookupRevision.current) return;
            setFetching(false);
            setError("Permissão de localização negada.");
        });
    };
    const persist = useCallback(async (current: AddressData) => {
        setError("");
        const coords = await fetchCoordinates(`${current.street}, ${current.number}, ${current.neighborhood}, ${current.city} - ${current.state}, ${current.cep}, Brasil`);
        if (!coords) throw new Error("Não conseguimos identificar a localização. Verifique o endereço.");
        await onSubmit({ ...current, latitude: coords.latitude, longitude: coords.longitude });
        lastSavedSnapshot.current = addressSnapshot(current);
        const cep = cleanCep(current.cep);
        const isNewCep = cep !== lastSavedCep.current;
        lastSavedCep.current = cep;
        if (!isNewCep || cep.length !== 8 || modeEnabled.current || dismissedCeps.current.has(cep)) return;
        try { if (localStorage.getItem(suggestionKey(restaurantId, cep))) return; } catch { /* Storage may be unavailable. */ }
        const lookup = cleanCep(lastCepAddress.current?.cep) === cep ? lastCepAddress.current : await fetchAddressByCEP(cep);
        if (!modeEnabled.current && draftCep.current === cep && lastSavedCep.current === cep && isCityWideCep(lookup, cep)) {
            setActivationError("");
            setSuggestedCep(cep);
        }
    }, [onSubmit, restaurantId]);
    const { status: saveStatus, error: saveError, reset, schedule } = useAutoSave(embedded ? "address" : null, persist);
    useEffect(() => {
        if (!embedded) return;
        const snapshot = addressSnapshot(form);
        const waitingForCep = cleanCep(form.cep) !== lastLookedUpCep.current;
        if (fetching || !valid || waitingForCep) {
            if (lastQueued.current !== null && (fetching || waitingForCep || snapshot !== lastQueued.current)) {
                lastQueued.current = null;
                reset();
            }
            return;
        }
        if (snapshot === lastQueued.current) return;
        lastQueued.current = snapshot;
        schedule(form);
    }, [embedded, fetching, form, reset, schedule, valid]);
    const canFinish = valid && !fetching && !isLoading && !activatingMode && !suggestedCep && saveStatus !== "saving" && saveStatus !== "error" && addressSnapshot(form) === lastSavedSnapshot.current;
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (embedded) return;
        if (!valid) { setInvalid(missing); const names: Record<RequiredField, string> = { cep: "CEP", state: "Estado", city: "Cidade", neighborhood: "Bairro", street: "Rua", number: "Número" }; setError(`Preencha: ${missing.map((item) => names[item]).join(", ")}.`); return; }
        try { await persist(form); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o endereço."); }
    };

    return <div className="mx-auto w-full min-w-0 max-w-2xl overflow-x-hidden px-0 sm:px-4"><SmallCityModeConfirmModal open={Boolean(suggestedCep) && !smallCityModeEnabled} suggested isLoading={activatingMode} error={activationError} onClose={closeSuggestion} onConfirm={() => void activateMode()} />{!embedded && <div className="mb-8 mt-4 text-center sm:text-left"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Etapa 1/4</p><h1 className="text-3xl font-bold text-gray-900">Onde fica sua loja?</h1><p className="mt-1 text-gray-500">Digite o CEP e complete as informações.</p></div>}{embedded && <SaveStatus status={saveStatus} className="mb-3" />}<button type="button" onClick={useLocation} disabled={fetching || isLoading} className="mb-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 py-3 font-medium text-brand transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"><FontAwesomeIcon icon={faLocationCrosshairs} /> {fetching ? "Buscando..." : "Usar minha localização"}</button><form onSubmit={submit} className="space-y-6"><div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-medium">CEP*</label><a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">Descubra seu CEP</a></div><Input value={form.cep} onChange={(e) => set("cep", e.target.value)} onBlur={e => void cepBlur(e.currentTarget.value)} placeholder="00000-000" className={fieldClass("cep")} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Input label="Estado*" value={form.state} onChange={(e) => set("state", e.target.value)} className={fieldClass("state")} disabled={fetching} /><div className="sm:col-span-2"><Input label="Cidade*" value={form.city} onChange={(e) => set("city", e.target.value)} className={fieldClass("city")} disabled={fetching} /></div></div><Input label="Bairro*" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className={fieldClass("neighborhood")} disabled={fetching} /><Input label="Rua*" value={form.street} onChange={(e) => set("street", e.target.value)} className={fieldClass("street")} disabled={fetching} /><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Input label="Número*" value={form.number} onChange={(e) => set("number", e.target.value)} className={fieldClass("number")} /><div className="sm:col-span-2"><Input label="Complemento" value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div></div>{(error || saveError) && <p role="alert" className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700">{error || saveError}</p>}{!embedded && <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"><div className={`mx-auto flex w-full max-w-4xl ${onBack ? "justify-between" : "justify-end"}`}>{onBack && <button type="button" onClick={onBack} className="cursor-pointer font-medium text-brand">Voltar</button>}<Tooltip text={!valid ? "Você precisa completar os dados primeiro" : ""} parentClassName="w-full sm:w-auto"><Button type="submit" loading={isLoading} className={`w-full px-8 sm:w-auto ${!valid ? "opacity-[0.55] hover:!bg-[#d93d00]" : ""}`}>{submitLabel}</Button></Tooltip></div></div>}</form>{embedded && onDone && <button type="button" onClick={() => { if (canFinish) onDone(); }} disabled={!canFinish} className="mt-3 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50">Concluir</button>}</div>;
}

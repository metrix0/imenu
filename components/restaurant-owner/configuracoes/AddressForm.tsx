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

interface Props { initialData?: Partial<AddressData>; onSubmit: (data: AddressData) => Promise<void>; onValidityChange?: (valid: boolean) => void; isLoading?: boolean; submitLabel?: string; embedded?: boolean; onBack?: () => void; }
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

export default function AddressForm({ initialData, onSubmit, onValidityChange, isLoading = false, submitLabel = "Salvar e Continuar", embedded = false, onBack }: Props) {
    const [form, setForm] = useState<AddressData>(() => ({ ...emptyAddress, ...initialData }));
    const [fetching, setFetching] = useState(false); const [error, setError] = useState(""); const [invalid, setInvalid] = useState<RequiredField[]>([]);
    const lastQueued = useRef<string | null>(addressSnapshot(form));
    const lastLookedUpCep = useRef((form.cep || "").replace(/\D/g, ""));
    useEffect(() => {
        if (!embedded && initialData) setForm((value) => ({ ...value, ...initialData }));
    }, [initialData, embedded]);
    const missing = useMemo(() => (["cep", "state", "city", "neighborhood", "street", "number"] as RequiredField[]).filter((key) => !String(form[key] ?? "").trim()), [form]);
    const valid = missing.length === 0;
    useEffect(() => onValidityChange?.(valid), [valid, onValidityChange]);
    const set = (key: keyof Omit<AddressData, "latitude" | "longitude">, value: string) => { setForm((v) => ({ ...v, [key]: value })); setInvalid((v) => v.filter((item) => item !== key)); };
    const fieldClass = (key: RequiredField) => invalid.includes(key) ? "!border-red-500 focus:!border-red-500 focus:!ring-red-500" : "";

    const cepBlur = async () => {
        const clean = (form.cep || "").replace(/\D/g, "");
        if (clean.length !== 8 || (embedded && clean === lastLookedUpCep.current)) return;
        setFetching(true); setError("");
        try { const address = await fetchAddressByCEP(clean); if (!address) throw new Error(); lastLookedUpCep.current = clean; setForm((v) => ({ ...v, cep: address.cep || v.cep, state: address.state, city: address.city, neighborhood: address.neighborhood, street: address.street, latitude: address.latitude ?? v.latitude, longitude: address.longitude ?? v.longitude })); if (!address.latitude || !address.longitude) { const coords = await fetchCoordinates(`${address.street}, ${address.neighborhood}, ${address.city} - ${address.state}, Brasil`); if (coords) setForm((v) => ({ ...v, ...coords })); } } catch { setError("CEP não encontrado. Preencha o endereço manualmente."); } finally { setFetching(false); }
    };
    const useLocation = () => {
        if (!navigator.geolocation) return setError("Geolocalização não suportada.");
        setFetching(true); setError(""); navigator.geolocation.getCurrentPosition(async ({ coords }) => { try { const address = await fetchAddressByCoordinates(coords.latitude, coords.longitude); if (!address) throw new Error(); setForm((v) => ({ ...v, ...address, number: address.number || v.number, latitude: coords.latitude, longitude: coords.longitude })); } catch { setError("Não foi possível obter o endereço completo."); } finally { setFetching(false); } }, () => { setFetching(false); setError("Permissão de localização negada."); });
    };
    const persist = useCallback(async (current: AddressData) => {
        setError("");
        const coords = await fetchCoordinates(`${current.street}, ${current.number}, ${current.neighborhood}, ${current.city} - ${current.state}, ${current.cep}, Brasil`);
        if (!coords) throw new Error("Não conseguimos identificar a localização. Verifique o endereço.");
        await onSubmit({ ...current, latitude: coords.latitude, longitude: coords.longitude });
    }, [onSubmit]);
    const { status: saveStatus, error: saveError, reset, schedule } = useAutoSave(embedded ? "address" : null, persist);
    useEffect(() => {
        if (!embedded) return;
        const snapshot = addressSnapshot(form);
        if (fetching || !valid) {
            if (lastQueued.current !== null && (fetching || snapshot !== lastQueued.current)) {
                lastQueued.current = null;
                reset();
            }
            return;
        }
        if (snapshot === lastQueued.current) return;
        lastQueued.current = snapshot;
        schedule(form);
    }, [embedded, fetching, form, reset, schedule, valid]);
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (embedded) return;
        if (!valid) { setInvalid(missing); const names: Record<RequiredField, string> = { cep: "CEP", state: "Estado", city: "Cidade", neighborhood: "Bairro", street: "Rua", number: "Número" }; setError(`Preencha: ${missing.map((item) => names[item]).join(", ")}.`); return; }
        try { await persist(form); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o endereço."); }
    };

    return <div className="mx-auto w-full min-w-0 max-w-2xl overflow-x-hidden px-0 sm:px-4">{!embedded && <div className="mb-8 mt-4 text-center sm:text-left"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Etapa 1/4</p><h1 className="text-3xl font-bold text-gray-900">Onde fica sua loja?</h1><p className="mt-1 text-gray-500">Digite o CEP e complete as informações.</p></div>}{embedded && <SaveStatus status={saveStatus} className="mb-3" />}<button type="button" onClick={useLocation} disabled={fetching || isLoading} className="mb-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 py-3 font-medium text-brand transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"><FontAwesomeIcon icon={faLocationCrosshairs} /> {fetching ? "Buscando..." : "Usar minha localização"}</button><form onSubmit={submit} className="space-y-6"><div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-medium">CEP*</label><a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">Descubra seu CEP</a></div><Input value={form.cep} onChange={(e) => set("cep", e.target.value)} onBlur={cepBlur} placeholder="00000-000" className={fieldClass("cep")} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Input label="Estado*" value={form.state} onChange={(e) => set("state", e.target.value)} className={fieldClass("state")} disabled={fetching} /><div className="sm:col-span-2"><Input label="Cidade*" value={form.city} onChange={(e) => set("city", e.target.value)} className={fieldClass("city")} disabled={fetching} /></div></div><Input label="Bairro*" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className={fieldClass("neighborhood")} /><Input label="Rua*" value={form.street} onChange={(e) => set("street", e.target.value)} className={fieldClass("street")} /><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Input label="Número*" value={form.number} onChange={(e) => set("number", e.target.value)} className={fieldClass("number")} /><div className="sm:col-span-2"><Input label="Complemento" value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div></div>{(error || saveError) && <p role="alert" className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700">{error || saveError}</p>}{!embedded && <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"><div className={`mx-auto flex w-full max-w-4xl ${onBack ? "justify-between" : "justify-end"}`}>{onBack && <button type="button" onClick={onBack} className="cursor-pointer font-medium text-brand">Voltar</button>}<Tooltip text={!valid ? "Você precisa completar os dados primeiro" : ""} parentClassName="w-full sm:w-auto"><Button type="submit" loading={isLoading} className={`w-full px-8 sm:w-auto ${!valid ? "opacity-[0.55] hover:!bg-[#d93d00]" : ""}`}>{submitLabel}</Button></Tooltip></div></div>}</form></div>;
}

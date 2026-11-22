"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import { nfceRequest } from "@/components/restaurant-owner/pedidos/NfceHistory";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import type { Issuer } from "@/lib/nfce/sefaz";

type Settings = Omit<Issuer, "series"> & { series: string; nextNumber: string; enabled: boolean; password: string; file: File | null };
const blank: Settings = {
    cnpj: "", ie: "", name: "", street: "", number: "", district: "", city: "", cityCode: "", cep: "",
    series: "1", nextNumber: "1", enabled: false, password: "", file: null,
    defaultTax: { ncm: "", cfop: "", csosn: "", origin: "", cest: "" },
};
const fields = [
    ["cnpj", "CNPJ"], ["ie", "Inscrição estadual"], ["name", "Razão social"], ["street", "Rua"], ["number", "Número"],
    ["district", "Bairro"], ["city", "Município"], ["cityCode", "Código IBGE do município"], ["cep", "CEP"],
    ["series", "Série"], ["nextNumber", "Próximo número"],
] as const;
const taxes = [["ncm", "NCM"], ["cfop", "CFOP"], ["csosn", "CSOSN"], ["origin", "Origem"], ["cest", "CEST"]] as const;

export default function NfceSettings({ restaurant }: { restaurant: string }) {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState<Settings>(blank);
    const [hasCertificate, setHasCertificate] = useState(false);
    const [items, setItems] = useState<{ id: string; name: string }[]>([]);
    const [itemId, setItemId] = useState("");
    const save = useCallback(async ({ file, password, ...settings }: Settings) => {
        const body = new FormData();
        body.set("settings", JSON.stringify(settings));
        if (file) {
            body.set("certificate", file);
            body.set("password", password);
        }
        const response = await nfceRequest(restaurant, { action: "settings" }, { method: "POST", body });
        const data = await response.json();
        setHasCertificate(data.has_certificate);
        if (file) setValue(current => current.file === file && current.password === password ? { ...current, file: null, password: "" } : current);
    }, [restaurant]);
    const { status, error, schedule } = useAutoSave<Settings>(restaurant, save);

    useEffect(() => {
        let current = true;
        nfceRequest(restaurant, { action: "settings" }).then(response => response.json()).then(data => {
            if (!current || !data.available || !data.plus) return;
            setVisible(true);
            setItems(data.items);
            if (data.issuer) {
                setValue({ ...blank, ...data.issuer.data, series: String(data.issuer.data.series),
                    nextNumber: String(data.issuer.next_number), enabled: data.issuer.enabled });
                setHasCertificate(data.issuer.has_certificate);
            }
        }).catch(() => undefined);
        return () => { current = false; };
    }, [restaurant]);

    const change = (next: Settings) => {
        setValue(next);
        if (fields.every(([key]) => next[key].trim()) && taxes.filter(([key]) => key !== "cest").every(([key]) => next.defaultTax[key]?.trim())
            && (!next.enabled || hasCertificate || next.file)) schedule(next);
    };
    const itemTax = value.itemTaxes?.[itemId] ?? value.defaultTax;

    if (!visible) return null;
    return <section id="nfce" aria-labelledby="nfce-title" className="scroll-mt-20 space-y-4">
        <h2 id="nfce-title" className="text-xl font-semibold text-gray-900">Notas Fiscais</h2>
        <Card className="space-y-4">
            <div className="flex items-center gap-3">
                <Switch checked={value.enabled} onClick={() => change({ ...value, enabled: !value.enabled })}
                    aria-label="Emissão automática em homologação" />
                <span className="text-sm">Emissão automática em homologação</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {fields.map(([key, label]) => <Input key={key} label={label} value={value[key]} onChange={event => change({ ...value, [key]: event.target.value })} />)}
            </div>
            <label className="block text-sm font-medium text-gray-800">Tributação
                <select className="ml-2 max-w-full rounded-md border border-gray-300 p-2" value={itemId} onChange={event => setItemId(event.target.value)}>
                    <option value="">Padrão dos itens</option>
                    {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {taxes.map(([key, label]) => <Input key={key} label={label} value={itemTax[key] ?? ""}
                    onChange={event => {
                        const replacement = { ...itemTax, [key]: event.target.value };
                        change(itemId ? { ...value, itemTaxes: { ...value.itemTaxes, [itemId]: replacement } } : { ...value, defaultTax: replacement });
                    }} />)}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input type="file" accept=".pfx,.p12" label={hasCertificate ? "Substituir certificado A1" : "Certificado A1"}
                    onChange={event => change({ ...value, file: event.target.files?.[0] ?? null })} />
                <Input type="password" label="Senha do certificado" autoComplete="new-password" value={value.password}
                    onChange={event => change({ ...value, password: event.target.value })} />
            </div>
            <SaveStatus status={status} />
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        </Card>
    </section>;
}

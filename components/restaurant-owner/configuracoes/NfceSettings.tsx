"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileBadge } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import SaveStatus from "@/components/ui/SaveStatus";
import CollapsibleSection, { useCollapsible } from "@/components/ui/CollapsibleSection";
import { nfceRequest } from "@/components/restaurant-owner/pedidos/NfceHistory";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import type { AddressData } from "@/lib/types/types";
import type { FiscalTax, Issuer } from "@/lib/nfce/sefaz";

type Settings = Omit<Issuer, "series"> & {
    series: string; nextNumber: string; enabled: boolean; password: string; file: File | null;
};
type StoreAddress = Partial<AddressData> | null;

const blank: Settings = {
    cnpj: "", ie: "", name: "", street: "", number: "", district: "", city: "", cityCode: "", cep: "",
    series: "1", nextNumber: "1", enabled: false, password: "", file: null,
    defaultTax: { ncm: "", cfop: "", csosn: "", origin: "", cest: "" },
};

const taxFields = [["ncm", "NCM"], ["cfop", "CFOP"]] as const;
const originOptions = [
    { value: "", label: "Selecione a origem" },
    { value: "0", label: "0 — Nacional" },
    { value: "1", label: "1 — Estrangeira (importação direta)" },
    { value: "2", label: "2 — Estrangeira (adquirida no Brasil)" },
    { value: "3", label: "3 — Nacional (conteúdo importado de 40% a 70%)" },
    { value: "4", label: "4 — Nacional (processo produtivo básico)" },
    { value: "5", label: "5 — Nacional (conteúdo importado até 40%)" },
    { value: "6", label: "6 — Estrangeira (sem similar nacional)" },
    { value: "7", label: "7 — Estrangeira (adquirida no Brasil, sem similar)" },
    { value: "8", label: "8 — Nacional (conteúdo importado superior a 70%)" },
];
const csosnOptions = [
    { value: "", label: "Selecione o CSOSN" },
    { value: "102", label: "102 — Sem permissão de crédito" },
    { value: "103", label: "103 — Isenção por faixa de receita" },
    { value: "300", label: "300 — Imune" },
    { value: "400", label: "400 — Não tributada" },
];

function withStoreAddress(value: Settings, address: StoreAddress): Settings {
    return {
        ...value,
        street: address?.street?.trim() || value.street,
        number: address?.number?.trim() || value.number,
        district: address?.neighborhood?.trim() || value.district,
        city: address?.city?.trim() || value.city,
        cep: address?.cep?.replace(/\D/g, "") || value.cep,
    };
}

function fiscalFieldsValid(value: Settings): boolean {
    const digits = (input: string) => input.replace(/\D/g, "");
    const validTax = (tax: FiscalTax) => /^\d{8}$/.test(digits(tax.ncm))
        && /^5\d{3}$/.test(digits(tax.cfop))
        && ["102", "103", "300", "400"].includes(digits(tax.csosn))
        && /^[0-8]$/.test(digits(tax.origin))
        && (!tax.cest || /^\d{7}$/.test(digits(tax.cest)));
    return /^\d{14}$/.test(digits(value.cnpj)) && /^\d{12}$/.test(digits(value.ie))
        && value.name.trim().length >= 2 && [value.street, value.number, value.district, value.city].every(Boolean)
        && /^35\d{5}$/.test(digits(value.cityCode)) && /^\d{8}$/.test(digits(value.cep))
        && Number.isInteger(Number(value.series)) && Number(value.series) >= 0 && Number(value.series) <= 889
        && Number.isInteger(Number(value.nextNumber)) && Number(value.nextNumber) >= 1
        && Number(value.nextNumber) <= 999999999
        && validTax(value.defaultTax) && Object.values(value.itemTaxes ?? {}).every(validTax);
}

function ready(value: Settings, hasCertificate: boolean): boolean {
    return fiscalFieldsValid(value) && (hasCertificate || Boolean(value.file && value.password));
}

export default function NfceSettings({ restaurant, address, locked = false }: { restaurant: string; address: StoreAddress; locked?: boolean }) {
    const [environment, setEnvironment] = useState<1 | 2 | null>(null);
    const [value, setValue] = useState<Settings>(blank);
    const [hasCertificate, setHasCertificate] = useState(false);
    const [items, setItems] = useState<{ id: string; name: string }[]>([]);
    const [itemId, setItemId] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const editor = useCollapsible({ defaultOpen: locked });
    const effective = withStoreAddress(value, address);

    const save = useCallback(async ({ file, password, ...settings }: Settings) => {
        const body = new FormData();
        body.set("settings", JSON.stringify({
            ...settings,
            street: address?.street?.trim() || settings.street,
            number: address?.number?.trim() || settings.number,
            district: address?.neighborhood?.trim() || settings.district,
            city: address?.city?.trim() || settings.city,
            cep: address?.cep?.replace(/\D/g, "") || settings.cep,
        }));
        if (file) {
            body.set("certificate", file);
            body.set("password", password);
        }
        const response = await nfceRequest(restaurant, { action: "settings" }, { method: "POST", body });
        const data = await response.json();
        setHasCertificate(data.has_certificate === true);
        if (file) setValue(current => current.file === file && current.password === password
            ? { ...current, file: null, password: "" } : current);
    }, [restaurant, address]);
    const { status, error, schedule } = useAutoSave<Settings>(restaurant, save);

    useEffect(() => {
        if (locked) return;
        let current = true;
        nfceRequest(restaurant, { action: "settings" }).then(response => response.json()).then(data => {
            if (!current || !data.plus) return;
            setEnvironment(data.environment);
            setItems(data.items ?? []);
            if (data.issuer) {
                setValue({ ...blank, ...data.issuer.data, series: String(data.issuer.data.series),
                    nextNumber: String(data.issuer.next_number),
                    enabled: data.issuer.data.requestedEnabled ?? data.issuer.enabled });
                setHasCertificate(data.issuer.has_certificate);
            }
        }).catch(() => undefined);
        return () => { current = false; };
    }, [restaurant, locked]);

    // The restaurant's existing CEP identifies the IBGE municipality without another form field.
    useEffect(() => {
        const cep = address?.cep?.replace(/\D/g, "") ?? "";
        if (locked || value.cityCode || !/^\d{8}$/.test(cep)) return;
        const controller = new AbortController();
        void fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (!data || !/^35\d{5}$/.test(String(data.ibge ?? ""))) return;
                const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                if (address?.city && normalize(String(data.localidade ?? "")) !== normalize(address.city)) return;
                setValue(current => current.cityCode ? current : { ...current, cityCode: String(data.ibge) });
            }).catch(() => undefined);
        return () => controller.abort();
    }, [locked, value.cityCode, address?.cep, address?.city]);

    const change = (next: Settings) => {
        if (locked) return;
        setValue(next);
        const complete = withStoreAddress(next, address);
        // Retain the selected certificate until the password is entered, while saving other fields.
        schedule(next.file && !next.password ? { ...complete, file: null } : complete);
    };
    const tax = value.itemTaxes?.[itemId] ?? value.defaultTax;
    const setTax = (field: keyof typeof tax, newValue: string) => {
        const replacement = { ...tax, [field]: newValue };
        change(itemId
            ? { ...value, itemTaxes: { ...value.itemTaxes, [itemId]: replacement } }
            : { ...value, defaultTax: replacement });
    };

    return (
        <Card className="border border-gray-200 shadow-sm">
            <CollapsibleSection
                title="Emissão automática de NFC-e"
                titleClassName="nfce-settings-title"
                description="Emita notas fiscais dos pedidos automaticamente, sem limites. Configure os dados da empresa e o certificado digital."
                titleBadge={<Badge preset={locked ? "plusIncluded" : "featureAvailable"} />}
                badge={!locked && value.enabled && !ready(effective, hasCertificate) && <Badge variant="warning">Não configurado</Badge>}
                open={editor.expanded}
                onOpenChange={editor.setExpanded}
                toggle={{
                    label: "Ativar emissão automática de NFC-e",
                    checked: !locked && value.enabled,
                    disabled: locked || !environment,
                    onChange: enabled => change({ ...value, enabled }),
                }}
            >
                <div className="space-y-5">
                    {!locked && !environment && <p className="text-sm text-gray-600">A emissão fiscal não está disponível neste ambiente.</p>}
                    <fieldset disabled={locked || !environment} className="min-w-0 space-y-5 disabled:opacity-50">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Input label="CNPJ" inputMode="numeric" value={value.cnpj} onChange={event => change({ ...value, cnpj: event.target.value })} />
                            <Input label="Inscrição estadual" inputMode="numeric" value={value.ie} onChange={event => change({ ...value, ie: event.target.value })} />
                            <Input label="Razão social" value={value.name} onChange={event => change({ ...value, name: event.target.value })} />
                        </div>
                        <div className="space-y-4">
                            <Dropdown custom label="Tributação" value={itemId} options={[
                                { value: "", label: "Padrão dos itens" },
                                ...items.map(item => ({ value: item.id, label: item.name })),
                            ]} onChange={event => setItemId(event.target.value)} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                {taxFields.map(([key, label]) => (
                                    <Input key={key} label={label} inputMode="numeric" value={tax[key] ?? ""}
                                        onChange={event => setTax(key, event.target.value)} />
                                ))}
                                <Dropdown custom label="CSOSN" value={tax.csosn ?? ""} options={csosnOptions}
                                    onChange={event => setTax("csosn", event.target.value)} />
                                <Dropdown custom label="Origem" value={tax.origin ?? ""} options={originOptions}
                                    onChange={event => setTax("origin", event.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-900">Certificado A1</p>
                            <input ref={fileRef} type="file" accept=".pfx,.p12" className="sr-only"
                                aria-label="Selecionar certificado A1"
                                onChange={event => change({ ...value, file: event.target.files?.[0] ?? null })} />
                            <div className="flex flex-wrap items-center gap-3">
                                <Button variant="secondary" onClick={() => fileRef.current?.click()} className="gap-2">
                                    <FileBadge size={16} strokeWidth={1.75} aria-hidden="true" />
                                    {hasCertificate ? "Substituir certificado" : "Selecionar certificado"}
                                </Button>
                                <span className="min-w-0 truncate text-sm text-gray-500">
                                    {value.file?.name || (hasCertificate ? "Certificado configurado" : "Nenhum certificado selecionado")}
                                </span>
                            </div>
                            {value.file && <Input type="password" label="Senha do certificado" autoComplete="new-password"
                                value={value.password} onChange={event => change({ ...value, password: event.target.value })} />}
                        </div>
                    </fieldset>
                    <CollapsibleSection title="Opções avançadas" inlineChevron defaultOpen={false}>
                        <fieldset disabled={locked || !environment} className="grid gap-4 sm:grid-cols-2 disabled:opacity-50">
                                    <Input label="Código IBGE do município" inputMode="numeric" value={value.cityCode}
                                        onChange={event => change({ ...value, cityCode: event.target.value })} />
                                    <Input label="CEST (opcional)" inputMode="numeric" value={tax.cest ?? ""}
                                        onChange={event => setTax("cest", event.target.value)} />
                                    <Input label="Série" inputMode="numeric" value={value.series}
                                        onChange={event => change({ ...value, series: event.target.value })} />
                                    <Input label="Próximo número" inputMode="numeric" value={value.nextNumber}
                                        onChange={event => change({ ...value, nextNumber: event.target.value })} />
                        </fieldset>
                    </CollapsibleSection>
                    {!locked && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                </div>
            </CollapsibleSection>
            {!locked && <SaveStatus status={status} />}
        </Card>
    );
}

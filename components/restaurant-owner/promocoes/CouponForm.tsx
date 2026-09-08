"use client";

import { useState, useRef, useEffect } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import ToggleInput from "@/components/ui/ToggleInput";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import Tooltip from "@/components/ui/Tooltip";
import DateRangePicker from "@/components/ui/DateRangePicker";


interface Props {
    restaurantId: string;
    initialData?: any;
    onCancel: () => void;
    onSaved: () => void;
    onError: (msg: string) => void;
    restaurant: any;
}

export default function CouponForm({
                                       restaurantId,
                                       initialData,
                                       onCancel,
                                       onSaved,
    onError,
                                        restaurant,
                                   }: Props) {
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [advancedOptions, setAdvancedOptions] = useState(false);


    const todayISO = () => {
        const d = new Date();
        return d.toISOString().split("T")[0];
    };

    const nextMonthSameDayISO = () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split("T")[0];
    };
    const [form, setForm] = useState({
        code: initialData?.code ?? "",
        discount_type: initialData?.discount_type ?? "percent",
        discount_value: initialData?.discount_value ?? 0,

        max_discount_value: initialData?.max_discount_value ?? null,
        min_order_value: initialData?.min_order_value ?? 0,

        quantity: initialData?.quantity ?? null,
        unlimited_quantity: initialData?.unlimited_quantity ?? true,

        start_date: initialData?.start_date ?? todayISO(),
        end_date: initialData?.end_date ?? nextMonthSameDayISO(),

        available_days: initialData?.available_days ?? [0, 1, 2, 3, 4, 5, 6],

        start_time: initialData?.start_time ?? "00:01",
        end_time: initialData?.end_time ?? "23:59",

        origins: initialData?.origins ?? ["retirada", "delivery", "autoatendimento"],

        active: initialData?.active ?? true,

        show_coupon: initialData?.show_coupon ?? true,
        one_coupon_per_user: initialData?.one_coupon_per_user ?? false,
    });
    const discountTypeRef = useRef<HTMLSelectElement | null>(null);

    const isCodeValid = form.code.trim().length > 0;

    const percentDisplay =
        form.discount_type === "percent"
            ? Math.round((form.discount_value ?? 0) * 100)
            : form.discount_value;

    const saveCoupon = async () => {
        if (!isCodeValid) return;

        setSaving(true);


        let existing_query = supabase
            .from("coupons")
            .select("id")
            .eq("restaurant_id", restaurantId)
            .eq("code", form.code);

        if (initialData?.id) {
            existing_query = existing_query.neq("id", initialData.id);
        }

        const { data: existing } = await existing_query.maybeSingle();

        if (existing) {
            onError("Já existe um cupom com esse código")
            setSaving(false);
            return;
        }

        const payload = {
            restaurant_id: restaurantId,
            ...form,
        };

        const query = initialData
            ? supabase.from("coupons").update(payload).eq("id", initialData.id)
            : supabase.from("coupons").insert(payload);

        const { error } = await query;

        setSaving(false);
        if (!error) onSaved();
    };

    const handleCopy = () => {
        const couponLink = `imenuapp.com.br/${restaurant.url_slug}/?c=${form.code}`;
        navigator.clipboard.writeText(couponLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

    useEffect(() => {
        if (!initialData || !discountTypeRef.current) return;

        discountTypeRef.current.value = initialData.discount_type;
    }, [initialData]);

    return (
        <Card className="mt-6">
        <div className="space-y-6">
            <div>
                <h2>{initialData ? "Editar cupom" : "Novo cupom"}</h2>
                <p className="mt-1 text-sm text-gray-500">Defina o desconto, a vigência e as condições de uso.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <Input
                    label="Código do desconto"
                    placeholder="JOAOOFF10"
                    value={form.code}
                    onChange={(e) =>
                        setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                />
                <div className={"relative "}>
                    <div className="w-full flex gap-2 items-end">
                        <div className="flex-1">
                            <Input
                                label="Link do Desconto (Aplicado Automaticamente)"
                                value={`imenuapp.com.br/${restaurant.url_slug}/?c=${form.code}`}
                                readOnly
                                locked={true}
                            />
                        </div>
                        <Button onClick={handleCopy} className="!h-11 px-3" variant="secondary" title="Copiar link" aria-label="Copiar link do cupom">
                            <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faCopy} />
                        </Button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
                <Dropdown
                    ref={discountTypeRef}
                    label="Tipo do desconto"
                    value={form.discount_type}
                    options={[
                        { value: "percent", label: "Porcentagem (%)" },
                        { value: "fixed", label: "Valor Fixo" },
                        { value: "delivery", label: "Entrega Grátis" },
                    ]}
                    onChange={(v) => {
                        console.log(v)
                        setForm({...form, discount_type: v.target.value})
                        console.log(form)
                    }}
                />
                <Input
                    label="Valor do desconto"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={form.discount_type === "percent" ? 100 : undefined}
                    step={form.discount_type === "percent" ? 1 : 0.01}
                    icon={`${form.discount_type === "fixed" ? "R$" : "%"}`}
                    iconPosition="right"
                    value={
                        form.discount_type === "percent"
                            ? percentDisplay
                            : `${form.discount_type === "fixed" ? form.discount_value : "100"}`
                    }
                    locked={form.discount_type === "delivery"}
                    disabled={form.discount_type === "delivery"}
                    onChange={(e) => {
                        const raw = Number(e.target.value);

                        setForm({
                            ...form,
                            discount_value:
                                form.discount_type === "percent"
                                    ? raw / 100
                                    : raw,
                        });
                    }}
                />


                <div className="sm:col-span-2 lg:col-span-1">
                    <DateRangePicker label="Vigência do cupom" presets={[]} allowFuture
                        value={{ startDate: form.start_date?.slice(0, 10) ?? "", endDate: form.end_date?.slice(0, 10) ?? "" }}
                        onChange={range => setForm({ ...form, start_date: range.startDate, end_date: range.endDate })} />
                </div>
            </div>

            <div>
                {/*<ToggleInput*/}
                {/*    label={<Tooltip text={<>Este cupom ficará visível para todos os usuários do seu Cardápio Digital. <u>Recomendado para converter mais clientes.</u></>} padding={"py-2 px-3"} size={"medium"} >*/}
                {/*        Mostrar este cupom <FontAwesomeIcon icon={icons.faCircleInfo} className={"text-xs text-gray-500"} /> <span className={"text-brand text-xs "}>RECOMENDADO</span>*/}
                {/*</Tooltip>}*/}

                {/*    checked={form.show_coupon}*/}
                {/*    onChange={(e) =>*/}
                {/*        setForm({*/}
                {/*            ...form,*/}
                {/*            show_coupon: e.target.checked,*/}
                {/*        })*/}
                {/*    }*/}
                {/*    color={"bg-green-500"}*/}
                {/*    className={"mt-4"}*/}
                {/*/>*/}
                <ToggleInput
                    label={<Tooltip text={<>Rastreado através do dispositivo do usuário</>} position={"right"} >
                        Um cupom por pessoa <FontAwesomeIcon icon={icons.faCircleInfo} className={"text-xs text-gray-500"} />
                    </Tooltip>}

                    checked={form.one_coupon_per_user}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            one_coupon_per_user: e.target.checked,
                        })
                    }
                    color={"bg-green-500"}
                    className={"mt-4"}
                />
            </div>

            <button type="button" className="flex min-h-11 w-full items-center justify-between border-t border-gray-200 pt-3 text-sm font-medium" aria-expanded={advancedOptions} aria-controls="coupon-advanced-options" onClick={() => setAdvancedOptions(!advancedOptions)}>Opções avançadas <FontAwesomeIcon className={`${advancedOptions ? "rotate-180" : ""} duration-300`} icon={icons.faChevronDown}/></button>

            <div
                id="coupon-advanced-options"
                hidden={!advancedOptions}
                className="space-y-6"
            >

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <Input
                        label="Valor mínimo do pedido"
                        icon="R$"
                        iconPosition="left"
                        type="number" min={0} step="0.01" inputMode="decimal"
                        value={form.min_order_value}
                        onChange={(e) =>
                            setForm({ ...form, min_order_value: Number(e.target.value) })
                        }
                    />

                    <Input
                        label="Valor máximo do desconto"
                        icon="R$"
                        iconPosition="left"
                        type="number" min={0} step="0.01" inputMode="decimal"
                        value={form.max_discount_value ?? ""}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                max_discount_value: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                            })
                        }
                    />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                        <Input
                            label="Quantidade de cupons disponíveis"
                            numeric
                            value={form.quantity ?? 0}
                            onChange={(e) =>
                                setForm({ ...form, quantity: Number(e.target.value) })
                            }
                            locked={form.unlimited_quantity}
                            disabled={form.unlimited_quantity}
                        />
                        <ToggleInput
                            label="Ilimitado"
                            checked={form.unlimited_quantity}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    unlimited_quantity: e.target.checked,
                                    quantity: e.target.checked ? null : form.quantity,
                                })
                            }
                            color={"bg-green-500"}
                            className={"mt-4"}
                        />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">
                            Origem
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4">
                            {["retirada", "delivery", "autoatendimento"].map((origin) => (
                                <ToggleInput
                                    key={origin}
                                    label={origin.charAt(0).toUpperCase() + origin.slice(1)}
                                    checked={form.origins.includes(origin)}
                                    color={"bg-green-500"}
                                    onChange={() =>
                                        setForm({
                                            ...form,
                                            origins: form.origins.includes(origin)
                                                ? form.origins.filter((o: any) => o !== origin)
                                                : [...form.origins, origin],
                                        })
                                    }
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                            Dias em que o cupom está disponível
                        </p>

                        <div className="flex gap-2 flex-wrap">
                            {days.map((day, index) => (
                                <Button
                                    key={day}
                                    aria-pressed={form.available_days.includes(index)}
                                    variant={
                                        form.available_days.includes(index)
                                            ? "primary"
                                            : "secondary"
                                    }
                                    onClick={() =>
                                        setForm({
                                            ...form,
                                            available_days: form.available_days.includes(index)
                                                ? form.available_days.filter((d: any) => d !== index)
                                                : [...form.available_days, index],
                                        })
                                    }
                                >
                                    {day}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Início"
                            type="time"
                            value={form.start_time}
                            onChange={(e) =>
                                setForm({ ...form, start_time: e.target.value })
                            }
                        />

                        <Input
                            label="Fim"
                            type="time"
                            value={form.end_time}
                            onChange={(e) =>
                                setForm({ ...form, end_time: e.target.value })
                            }
                        />
                    </div>

                </div>


            </div>

            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
                <Tooltip text={!isCodeValid ? "O código do cupom é obrigatório" : ""}>
                    <Button variant="primary" loading={saving} onClick={saveCoupon} disabled={!isCodeValid}>
                        Salvar
                    </Button>
                </Tooltip>
            </div>
        </div>
        </Card>
    );
}

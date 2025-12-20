"use client";

import { useState, useRef, useEffect } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import ToggleInput from "@/components/ui/ToggleInput";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import Tooltip from "@/components/ui/Tooltip";


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
        <Card className={"mt-4"}>
        <div className="mt-6 space-y-8">
            <div className={"grid-cols-2 gap-6 grid"}>

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
                                onChange={(e) =>
                                    setForm({ ...form, code: e.target.value.toUpperCase() })
                                }
                                locked={true}
                            />
                        </div>
                        <Button onClick={handleCopy} className="px-3 h-13" variant="secondary" title="Copiar Link">
                            <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faCopy} />
                        </Button>
                    </div>
                </div>
            </div>
            <div className={"grid-cols-4 gap-6 grid"}>
                <Dropdown
                    ref={discountTypeRef}
                    label="Tipo do desconto"
                    options={[
                        { value: "percent", label: "Porcentagem (%)" },
                        { value: "fixed", label: "Valor Fixo" },
                    ]}
                    onChange={(v) => {
                        console.log(v)
                        setForm({...form, discount_type: v.target.value})
                        console.log(form)
                    }}
                />
                <Input
                    label="Valor do desconto"
                    numeric
                    icon={`${form.discount_type === "percent" ? "%" : "R$"}`}
                    iconPosition="right"
                    value={
                        form.discount_type === "percent"
                            ? percentDisplay
                            : form.discount_value
                    }
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


                <Input
                    label="Disponível entre"
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                    }
                />

                <Input
                    label="Até"
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                    }
                />
            </div>

            <div>
                <ToggleInput
                    label={<Tooltip text={<>Este cupom ficará visível para todos os usuários do seu Cardápio Digital. <u>Recomendado para converter mais clientes.</u></>} padding={"py-2 px-3"} size={"medium"} >
                        Mostrar este cupom <FontAwesomeIcon icon={icons.faCircleInfo} className={"text-xs text-gray-500"} /> <span className={"text-brand text-xs "}>RECOMENDADO</span>
                </Tooltip>}

                    checked={form.show_coupon}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            show_coupon: e.target.checked,
                        })
                    }
                    color={"bg-green-500"}
                    className={"mt-4"}
                />
            </div>

            <p className={"text-xs font-semibold -mt-2 cursor-pointer"} onClick={() => setAdvancedOptions(!advancedOptions)}>Opções Avançadas <FontAwesomeIcon className={`${advancedOptions ? "rotate-180" : ""} duration-300`} icon={icons.faChevronDown}/></p>

            <div
                className={`
    transition-all duration-500 ease-out space-y-6
    ${advancedOptions
                    ? "opacity-100 max-h-96 translate-y-0"
                    : "opacity-0 max-h-0 -translate-y-2 overflow-hidden -mt-8"}
  `}
            >

                <div className={"grid-cols-2 gap-6 grid"}>

                    <Input
                        label="Valor mínimo do pedido"
                        icon="R$"
                        iconPosition="left"
                        numeric
                        value={form.min_order_value}
                        onChange={(e) =>
                            setForm({ ...form, min_order_value: Number(e.target.value) })
                        }
                    />

                    <Input
                        label="Valor máximo do desconto"
                        icon="R$"
                        iconPosition="left"
                        numeric
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
                <div className={"grid-cols-2 gap-6 grid"}>
                    <div className={"flex gap-6 items-center"}>
                        <Input
                            label="Quantidade de cupons disponíveis"
                            numeric
                            value={form.quantity ?? 0}
                            onChange={(e) =>
                                setForm({ ...form, quantity: Number(e.target.value) })
                            }
                            locked={form.unlimited_quantity}
                            className={"!w-85"}
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
                        <div className={"flex gap-6 mt-4"}>
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
                <div className={"grid-cols-2 gap-6 grid"}>
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                            Dias em que o cupom está disponível
                        </p>

                        <div className="flex gap-2 flex-wrap">
                            {days.map((day, index) => (
                                <Button
                                    key={day}
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

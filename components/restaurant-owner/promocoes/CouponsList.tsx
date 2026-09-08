"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import Tooltip from "@/components/ui/Tooltip";
import ListLoader from "@/components/ui/ListLoader";

interface Props {
    restaurantId: string;
    onCreate: () => void;
    onEdit: (coupon: any) => void;
    onToast: (msg: string, type: "success" | "error") => void;
    restaurant: any;
}

export default function CouponsList({
                                        restaurantId,
                                        onCreate,
                                        onEdit,
                                        onToast,
    restaurant,
                                    }: Props) {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const loadCoupons = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("coupons")
            .select("*")
            .eq("restaurant_id", restaurantId)
            .order("created_at", { ascending: false });

        setCoupons(data || []);
        setLoading(false);
    };

    useEffect(() => {
        loadCoupons();
    }, []);

    const toggleActive = async (coupon: any, active: boolean) => {
        setCoupons(prev =>
            prev.map(c =>
                c.id === coupon.id ? { ...c, active } : c
            )
        );

        const { error } = await supabase
            .from("coupons")
            .update({ active })
            .eq("id", coupon.id);

        if (error) {
            setCoupons(prev =>
                prev.map(c =>
                    c.id === coupon.id ? { ...c, active: !active } : c
                )
            );
            onToast("Erro ao atualizar status", "error");
        }
    };

    const handleCopy = (c: any) => {
        const couponLink = `imenuapp.com.br/${restaurant.url_slug}/?c=${c.code}`;
        navigator.clipboard.writeText(couponLink);
        setCopied(c.id);
        setTimeout(() => setCopied(null), 2000);
    }

    const formatDateBR = (date?: string) => {
        if (!date) return "-";
        const [y, m, d] = date.split("-");
        return `${d}/${m}/${y}`;
    };

    const deleteCoupon = async () => {
        const { error } = await supabase
            .from("coupons")
            .delete()
            .eq("id", deleteTarget.id);

        if (error) {
            onToast("Erro ao excluir cupom", "error");
        } else {
            onToast("Cupom excluído com sucesso", "success");
            loadCoupons();
        }

        setDeleteTarget(null);
    };

    return (
        <div className="mt-6 space-y-4">
            {/* Header */}
            <div className="flex justify-end">
                <Button variant="primary" onClick={onCreate}>
                    Criar cupom
                </Button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="py-2 text-center text-gray-500">
                    <>
                        <div className="mt-0">
                            <ListLoader lines={4}/>
                        </div>

                        <div className="mt-8">
                            <ListLoader lines={4}/>
                        </div>
                    </>
                </div>
            )}

            {/* Empty */}
            {!loading && coupons.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center mx-10 h-[70%]">
                    <img src="/images/eyebrow_emoji.png" alt="Nada encontrado" className="w-38 h-38 mb-4" />
                    <p className="text-gray-500 text-md mb-4">Nenhum cupom criado.</p>
                    <Button variant="primary" onClick={onCreate}>
                        Criar cupom
                    </Button>
                </div>
            )}

            {/* Table */}
            {!loading && coupons.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full text-sm tabular-nums">
                        <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Cupom</th>
                            <th className="px-4 py-3 text-left font-medium">Valor</th>
                            <th className="px-4 py-3 text-center font-medium">Usos</th>
                            <th className="px-4 py-3 text-left font-medium">Duração</th>
                            <th className="px-4 py-3 text-center font-medium"><Tooltip text={"Este link ativa o cupom automaticamente"} position={"right"}>Link <FontAwesomeIcon icon={icons.faCircleInfo} className={"text-xs"}/></Tooltip></th>
                            <th className="px-4 py-3 text-center font-medium">Ativo</th>
                            <th className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y">
                        {coupons.map((c) => (
                            <tr key={c.id} className="border-gray-50 hover:bg-gray-50 duration-200">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    {c.code}
                                </td>

                                <td className={`px-4 py-3 text-gray-700 ${c.discount_type === "delivery" && "text-xs"}`}>
                                    {c.discount_type === "percent" ? `${Math.round(c.discount_value * 100)}%` : c.discount_type === "fixed" ? Number(c.discount_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Entrega grátis"}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700">
                                    {c.usage_count}{c.unlimited_quantity ? "" : ` de ${c.quantity ?? "-"}`}
                                </td>



                                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                    <p>{formatDateBR(c.start_date)}</p><p className="mt-1 text-xs text-gray-500">até {formatDateBR(c.end_date)}</p>
                                </td>

                                <td className="px-4 py-3 text-center" >
                                    <Button variant="secondary" onClick={() => handleCopy(c)} aria-label={`Copiar link de ${c.code}`} className="gap-2">
                                        <FontAwesomeIcon icon={copied === c.id ? icons.faCheck : icons.faLink} />
                                        {copied === c.id ? "Copiado" : "Copiar"}
                                    </Button>
                                </td>

                                <td className="px-4 py-3 text-center">
                                    <Switch
                                        aria-label={`Ativar cupom ${c.code}`}
                                        checked={c.active}
                                        onClick={() => toggleActive(c, !c.active)}
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="secondary" aria-label={`Editar cupom ${c.code}`} onClick={() => onEdit(c)} className="!w-10 !px-0"><FontAwesomeIcon icon={icons.faEdit} /></Button>
                                        <Button variant="secondary" aria-label={`Excluir cupom ${c.code}`} onClick={() => setDeleteTarget(c)} className="!w-10 !px-0 text-red-600"><FontAwesomeIcon icon={icons.faTrash} /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete modal */}
            <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-3">
                        Excluir cupom
                    </h2>

                    <p className="text-gray-600 mb-6">
                        Tem certeza que deseja excluir o cupom{" "}
                        <strong>{deleteTarget?.code}</strong>?
                    </p>

                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={deleteCoupon}>
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

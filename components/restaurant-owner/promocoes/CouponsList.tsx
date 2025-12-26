"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ToggleInput from "@/components/ui/ToggleInput";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import Tooltip from "@/components/ui/Tooltip";

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
    const [copied, setCopied] = useState(false);

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
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                <div className="py-10 text-center text-gray-500">
                    Carregando cupons…
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
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Cupom</th>
                            <th className="px-4 py-3 text-left font-medium">Valor</th>
                            <th className="px-4 py-3 text-left font-medium">Usos</th>
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
                                    {c.discount_type === "percent"
                                        ? `${Math.round(c.discount_value * 100)}%`
                                        : `${c.discount_type === "fixed" ? `R$ ${c.discount_value}` : ""}`
                                    }
                                    {c.discount_type === "delivery" && <span>Entrega</span>}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700">
                                    {c.usage_count}{c.unlimited_quantity ? "" : ` de ${c.quantity ?? "-"}`}
                                </td>



                                <td className="px-4 py-3 text-gray-700">
                                    {formatDateBR(c.start_date)} à {formatDateBR(c.end_date)}
                                </td>

                                <td className="px-4 py-3 text-center" >
                                    <div onClick={() => handleCopy(c)} className={"flex justify-center items-center gap-2 cursor-pointer"}>
                                        <p className={"py-1 px-2 bg-gray-100 rounded-full text-xs text-gray-600 break-all max-w-60 whitespace-nowrap overflow-hidden text-ellipsis"}>
                                            imenuapp.com.br/{restaurant.url_slug}/{c.code}
                                        </p>
                                        <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faLink} className={"text-gray-400 duration-100 hover:text-gray-500 cursor-pointer"} />
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-center">
                                    <ToggleInput
                                        label=""
                                        checked={c.active}
                                        onChange={(e) => toggleActive(c, e.target.checked)
                                        }
                                        className={"items-center justify-center"}
                                        color={"bg-green-500"}
                                    />
                                </td>

                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-5 items-center text-md">
                                        <Tooltip text={"Editar"}>
                                        <FontAwesomeIcon onClick={() => onEdit(c)} icon={icons.faEdit} className={"text-gray-400 duration-100 hover:text-gray-500 cursor-pointer"} />
                                        </Tooltip>
                                        <FontAwesomeIcon onClick={() => setDeleteTarget(c)} icon={icons.faTrash} className={"text-gray-400 duration-100 hover:text-red-700 cursor-pointer mr-2"} />
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

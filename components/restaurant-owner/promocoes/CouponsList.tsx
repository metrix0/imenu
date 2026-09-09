"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import PromotionCard from "./PromotionCard";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { faTicket } from "@fortawesome/free-solid-svg-icons";
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
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
                    <FontAwesomeIcon icon={faTicket} className="mb-3 text-2xl text-gray-500" />
                    <p className="text-gray-500 text-md mb-4">Nenhum cupom criado.</p>
                    <Button variant="primary" onClick={onCreate}>
                        Criar cupom
                    </Button>
                </div>
            )}

            {!loading && coupons.map(c => (
                <PromotionCard key={c.id} title={c.code} active={c.active}
                    onToggle={() => void toggleActive(c, !c.active)}
                    description={c.discount_type === "percent" ? `${Math.round(c.discount_value * 100)}% de desconto` : c.discount_type === "fixed" ? `${Number(c.discount_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de desconto` : "Entrega grátis"}
                    actions={<>
                        <Button variant="secondary" onClick={() => handleCopy(c)} aria-label={`Copiar link de ${c.code}`} className="mr-auto gap-2">
                            <FontAwesomeIcon icon={copied === c.id ? icons.faCheck : icons.faLink} />{copied === c.id ? "Copiado" : "Copiar link"}
                        </Button>
                        <Button variant="secondary" aria-label={`Editar cupom ${c.code}`} onClick={() => onEdit(c)} className="gap-2"><FontAwesomeIcon icon={icons.faEdit} />Editar</Button>
                        <Button variant="secondary" aria-label={`Excluir cupom ${c.code}`} onClick={() => setDeleteTarget(c)} className="!w-10 !px-0"><FontAwesomeIcon icon={icons.faTrash} /></Button>
                    </>}
                >
                    <span><strong className="font-medium text-gray-700">Usos:</strong> {c.usage_count ?? 0}{c.unlimited_quantity ? " · sem limite" : ` de ${c.quantity ?? "-"}`}</span>
                    <span><strong className="font-medium text-gray-700">Validade:</strong> {c.start_date ? formatDateBR(c.start_date) : "Imediata"} · {c.end_date ? `até ${formatDateBR(c.end_date)}` : "Sem data final"}</span>
                </PromotionCard>
            ))}

            {/* Delete modal */}
            <Modal height={240} open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
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

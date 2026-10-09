"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faBellConcierge, faCheck, faLock, faMotorcycle } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import { supabase } from "@/lib/database/supabaseClient";
import { hasQrTableAccess } from "@/lib/qr-table/types";

export default function StaffPanelsPage() {
    const router = useRouter();
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [waiterAccess, setWaiterAccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [salesOpen, setSalesOpen] = useState(false);

    const loadAccess = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/restaurante/login");
                return;
            }
            const { data: restaurant, error: restaurantError } = await supabase
                .from("restaurants").select("id").eq("user_id", session.user.id).maybeSingle();
            if (restaurantError) throw restaurantError;
            if (!restaurant) throw new Error("Restaurante não encontrado.");
            setRestaurantId(restaurant.id);
            const { data: addon, error: addonError } = await supabase
                .from("restaurant_addons").select("status, current_period_ends_at")
                .eq("restaurant_id", restaurant.id).eq("product_key", "qr_code_mesa").maybeSingle();
            if (addonError) throw addonError;
            setWaiterAccess(hasQrTableAccess(addon));
        } catch {
            setError("Não foi possível carregar os painéis.");
            setWaiterAccess(false);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { void loadAccess(); }, [loadAccess]);

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader /></div>;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
            <div className="panel-page-heading mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Motoboy/Garçom</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Acesse os painéis para organizar as entregas e o atendimento das mesas.
                </p>
            </div>
            {error ? <Card><p className="text-sm text-red-700">{error}</p><Button className="mt-4" onClick={() => void loadAccess()}>Tentar novamente</Button></Card> : (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="flex flex-col">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={faBellConcierge} className="text-xl" />
                            </span>
                            <span className={`text-xs font-medium ${waiterAccess ? "text-green-700" : "text-gray-500"}`}>
                                {waiterAccess ? "Disponível" : "iMenu QR Code Mesa"}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Painel Garçom</h2>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">
                            Organize o atendimento e acompanhe os pedidos de cada mesa em um só lugar.
                        </p>
                        <ul className="my-6 space-y-3 text-sm text-gray-600">
                            {[
                                "Veja suas mesas e os pedidos em aberto",
                                "Adicione novos pedidos direto na mesa",
                                "Finalize a mesa ao concluir o atendimento",
                            ].map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <FontAwesomeIcon icon={faCheck} className="mt-1 shrink-0 text-brand" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <Button variant="secondary" className="mt-auto w-full" onClick={() => waiterAccess ? window.open("/garcom", "_blank", "noopener,noreferrer") : setSalesOpen(true)}>
                            <FontAwesomeIcon icon={faBellConcierge} className="mr-2" />
                            Painel Garçom
                            {!waiterAccess && <FontAwesomeIcon icon={faLock} className="ml-2" />}
                        </Button>
                    </Card>
                    <Card className="flex flex-col">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={faMotorcycle} className="text-xl" />
                            </span>
                            <span className="text-xs font-medium text-green-700">Disponível</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Painel Motoboy</h2>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">
                            Veja os pedidos prontos para entrega e acompanhe cada entrega até a conclusão.
                        </p>
                        <ul className="my-6 space-y-3 text-sm text-gray-600">
                            {[
                                "Pedidos prontos para entregar",
                                "Endereço, telefone e informações de pagamento",
                                "Marque como Entregue e consulte as entregas concluídas",
                            ].map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <FontAwesomeIcon icon={faCheck} className="mt-1 shrink-0 text-brand" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <Button className="mt-auto w-full" onClick={() => window.open("/motoboy", "_blank", "noopener,noreferrer")}>
                            <FontAwesomeIcon icon={faMotorcycle} className="mr-2" />
                            Painel Motoboy
                        </Button>
                    </Card>
                </div>
            )}
            {restaurantId && <QrCodeMesaSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} restaurantId={restaurantId} source="mesas" onPaid={loadAccess} />}
        </div>
    );
}

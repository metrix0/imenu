"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon, faMotorRacingHelmet } from "@/components/ui/PanelIcon";
import { faUpRightFromSquare, faBellConcierge, faCheck, faCopy, faLock } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import Tooltip from "@/components/ui/Tooltip";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import { supabase } from "@/lib/database/supabaseClient";
import { hasQrTableAccess } from "@/lib/qr-table/types";

const WAITER_PLAN_MESSAGE = "Essa é uma função do plano iMenu QR Code Mesa";
type StaffPanel = "garcom" | "motoboy";

export default function StaffPanelsPage() {
    const router = useRouter();
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [waiterAccess, setWaiterAccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [salesOpen, setSalesOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<{ panel: StaffPanel; success: boolean } | null>(null);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    useEffect(() => () => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    }, []);

    const copyPanelLink = async (panel: StaffPanel) => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        try {
            await navigator.clipboard.writeText(new URL(`/${panel}`, window.location.origin).href);
            setCopyFeedback({ panel, success: true });
            copyTimeoutRef.current = setTimeout(() => setCopyFeedback(null), 2000);
        } catch {
            setCopyFeedback({ panel, success: false });
        }
    };

    const renderCopyButton = (panel: StaffPanel, label: string) => (
        <div className="mt-2">
            <Button variant="secondary" className="w-full gap-2" aria-label={`Copiar link do ${label}`} onClick={() => void copyPanelLink(panel)}>
                <FontAwesomeIcon icon={copyFeedback?.panel === panel && copyFeedback.success ? faCheck : faCopy} />
                <span aria-live="polite">{copyFeedback?.panel === panel && copyFeedback.success ? "Link copiado!" : "Copiar link"}</span>
            </Button>
            {copyFeedback?.panel === panel && !copyFeedback.success && <p role="alert" className="mt-2 text-xs text-red-700">Não foi possível copiar o link. Tente novamente.</p>}
        </div>
    );

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader /></div>;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
            <header className="panel-page-heading mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Motoboy e Garçom</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                    Cada pedido no lugar certo. Escolha o painel para acompanhar as entregas ou atender suas mesas.
                </p>
            </header>
            {error ? <Card><p role="alert" className="text-sm text-red-700">{error}</p><Button className="mt-4" onClick={() => void loadAccess()}>Tentar novamente</Button></Card> : (
                <div className="grid gap-5 lg:grid-cols-2">
                    <Card className="flex min-w-0 flex-col !p-6 sm:!p-7">
                        <div className="mb-6 flex items-center justify-between gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand" aria-hidden="true">
                                <FontAwesomeIcon icon={faBellConcierge} className="text-xl" />
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${waiterAccess ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-800"}`}>
                                <FontAwesomeIcon icon={waiterAccess ? faCheck : faLock} />
                                {waiterAccess ? "Plano ativo" : "Incluso no plano iMenu QR Code"}
                            </span>
                        </div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Atendimento nas mesas</p>
                        <Tooltip text={WAITER_PLAN_MESSAGE} disabled={waiterAccess} parentClassName="!block">
                            <h2 className="text-xl font-bold text-gray-900">Painel Garçom</h2>
                        </Tooltip>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">
                            Da chegada do cliente ao fechamento da mesa, organize o atendimento em um só lugar.
                        </p>
                        <ul className="my-6 flex-1 space-y-3 text-sm text-gray-600">
                            {[
                                "Veja suas mesas e os pedidos em aberto",
                                "Adicione novos pedidos direto na mesa",
                                "Finalize a mesa ao concluir o atendimento",
                            ].map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <FontAwesomeIcon icon={faCheck} className="mt-1 shrink-0 text-brand" aria-hidden="true" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-gray-200 pt-5">
                            <Tooltip text={WAITER_PLAN_MESSAGE} disabled={waiterAccess} parentClassName="!block">
                                <Button className="w-full gap-2" onClick={() => waiterAccess ? window.open("/garcom", "_blank", "noopener,noreferrer") : setSalesOpen(true)}>
                                    <FontAwesomeIcon icon={waiterAccess ? faUpRightFromSquare : faLock} />
                                    {waiterAccess ? "Abrir Painel Garçom" : "Desbloquear Painel Garçom"}
                                </Button>
                            </Tooltip>
                            {renderCopyButton("garcom", "Painel Garçom")}
                        </div>
                    </Card>
                    <Card className="flex min-w-0 flex-col !p-6 sm:!p-7">
                        <div className="mb-6 flex items-center justify-between gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand" aria-hidden="true">
                                <FontAwesomeIcon icon={faMotorRacingHelmet} className="text-xl" />
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"><FontAwesomeIcon icon={faCheck} />Grátis</span>
                        </div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Entregas</p>
                        <h2 className="text-xl font-bold text-gray-900">Painel Motoboy</h2>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">
                            Saiba o que está pronto para sair e registre cada entrega assim que chegar ao cliente.
                        </p>
                        <ul className="my-6 flex-1 space-y-3 text-sm text-gray-600">
                            {[
                                "Veja somente os pedidos prontos para entrega",
                                "Endereço, telefone e informações de pagamento",
                                "Marque como Entregue e consulte os últimos 3 dias",
                            ].map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <FontAwesomeIcon icon={faCheck} className="mt-1 shrink-0 text-brand" aria-hidden="true" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-gray-200 pt-5">
                            <Button className="w-full gap-2" onClick={() => window.open("/motoboy", "_blank", "noopener,noreferrer")}>
                                <FontAwesomeIcon icon={faUpRightFromSquare} />
                                Abrir Painel Motoboy
                            </Button>
                            {renderCopyButton("motoboy", "Painel Motoboy")}
                        </div>
                    </Card>
                </div>
            )}
            {!error && <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">Os painéis abrem em uma nova aba, para você manter o painel principal à mão.</p>}
            {restaurantId && <QrCodeMesaSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} restaurantId={restaurantId} source="mesas" onPaid={loadAccess} />}
        </div>
    );
}

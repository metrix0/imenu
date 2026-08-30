"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import DeliveryRules, { DeliveryRulesRef } from "@/components/restaurant-owner/configuracoes/TempoeTaxa";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

export default function TempoETaxaPage() {
    const router = useRouter(); const { restaurantId: storedId, setRestaurantId } = useCreationStore();
    const [restaurantId, setId] = useState<string | null>(storedId); const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(!storedId); const rulesRef = useRef<DeliveryRulesRef>(null);
    useEffect(() => { if (restaurantId) return; void (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return router.replace("/restaurante/login"); const { data } = await supabase.from("restaurants").select("id").eq("user_id", session.user.id).single(); if (data) { setId(data.id); setRestaurantId(data.id); } setLoading(false); })(); }, [restaurantId]);
    const save = async () => { if (!rulesRef.current || !restaurantId) return; setSaving(true); try { await rulesRef.current.save(); const response = await fetch(`/api/restaurants/${restaurantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_step: 3 }) }); if (!response.ok) throw new Error(); router.push("/restaurante/criar/disponibilidade"); } catch { alert("Não foi possível salvar as configurações."); } finally { setSaving(false); } };
    if (loading || !restaurantId) return <div className="flex min-h-[50vh] items-center justify-center"><Loader className="border-t-brand" /></div>;
    return <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6"><div className="mb-8 text-center sm:text-left"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Etapa 2/4</p><h1 className="text-3xl font-bold">Tempo e Taxa de Entrega</h1><p className="mt-1 text-gray-500">Defina as regras de entrega para o seu restaurante.</p></div><DeliveryRules ref={rulesRef} restaurantId={restaurantId} isNew /><div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"><div className="mx-auto flex max-w-4xl items-center justify-between"><button onClick={() => router.back()} className="cursor-pointer font-medium text-brand">Voltar</button><Button onClick={save} loading={saving} className="px-8">Salvar e Continuar</Button></div></div></div>;
}

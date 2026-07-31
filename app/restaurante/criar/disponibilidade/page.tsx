"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import WeeklyScheduleClick, { Availability, TimeSlot } from "@/components/restaurant-owner/configuracoes/WeeklyScheduleClick";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

export default function DisponibilidadePage() {
    const router = useRouter(); const { setRestaurantId } = useCreationStore();
    const [availability, setAvailability] = useState<Availability>({}); const [id, setId] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
    useEffect(() => { void (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return router.replace("/restaurante/login"); const { data } = await supabase.from("restaurants").select("id,availability_json").eq("user_id", session.user.id).single(); if (data) { setId(data.id); setRestaurantId(data.id); setAvailability((data.availability_json as Availability) || {}); } setLoading(false); })(); }, []);
    const recommended = () => { const slots: TimeSlot[] = [{ open: "11:00", close: "15:00" }, { open: "18:00", close: "23:00" }]; setAvailability(Object.fromEntries(["0","1","2","3","4","5","6"].map((key) => [key, slots.map((slot) => ({ ...slot }))]))); };
    const save = async () => { if (!id) return; setSaving(true); try { const response = await fetch(`/api/restaurants/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ availability_json: availability, creation_step: 4 }) }); if (!response.ok) throw new Error(); router.push("/restaurante/criar/cardapio"); } catch { alert("Erro ao salvar horários."); } finally { setSaving(false); } };
    if (loading) return <main className="flex min-h-[50vh] items-center justify-center"><Loader className="border-t-brand" /></main>;
    return <div className="flex min-h-screen flex-col bg-white"><div className="mx-auto w-full max-w-6xl flex-1 overflow-x-auto px-4 pb-32 pt-8 sm:px-6"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">Etapa 3/4</p><h1 className="text-3xl font-bold">Horário de Funcionamento</h1><p className="mt-1 text-gray-500">Arraste os blocos para mover ou redimensionar os horários.</p></div><button onClick={recommended} className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5">Usar horários recomendados</button></div><WeeklyScheduleClick value={availability} onChange={setAvailability} /></div><div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"><div className="mx-auto flex max-w-4xl items-center justify-between"><button onClick={() => router.back()} className="font-medium text-brand">Voltar</button><Button onClick={save} loading={saving} className="px-8">Salvar e Continuar</Button></div></div></div>;
}

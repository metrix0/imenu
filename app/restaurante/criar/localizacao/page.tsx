"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { supabase } from "@/lib/database/supabaseClient";
import AddressForm from "@/components/restaurant-owner/configuracoes/AddressForm";
import Loader from "@/components/ui/Loader";
import { AddressData } from "@/lib/types/types";

export default function LocalizacaoPage() {
    const router = useRouter(); const { restaurantId, setRestaurantId } = useCreationStore();
    const [id, setId] = useState<string | null>(restaurantId); const [initial, setInitial] = useState<Partial<AddressData>>({}); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
    useEffect(() => { void (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return router.replace("/restaurante/login"); const { data } = await supabase.from("restaurants").select("id,address,latitude,longitude").eq("user_id", session.user.id).maybeSingle(); if (data) { setId(data.id); setRestaurantId(data.id); setInitial({ ...(data.address || {}), latitude: data.latitude, longitude: data.longitude }); } setLoading(false); })(); }, []);
    const save = async (data: AddressData) => { if (!id) return; setSaving(true); try { const response = await fetch(`/api/restaurants/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: data, latitude: data.latitude, longitude: data.longitude, creation_step: 2 }) }); if (!response.ok) throw new Error(); router.push("/restaurante/criar/tempo-e-taxa"); } catch { alert("Não foi possível salvar. Tente novamente."); } finally { setSaving(false); } };
    if (loading) return <main className="flex min-h-[50vh] items-center justify-center"><Loader className="border-t-brand" /></main>;
    return <main className="w-full min-w-0 overflow-x-hidden px-4 pb-32 pt-4"><AddressForm initialData={initial} onSubmit={save} isLoading={saving} onValidityChange={() => {}} /></main>;
}

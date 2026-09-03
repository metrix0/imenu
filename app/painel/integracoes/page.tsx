"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ListLoader from "@/components/ui/ListLoader";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const extractFirst = (value: string, pattern: RegExp) =>
    value.toUpperCase().match(pattern)?.[0] ?? "";

const cleanGa4Id = (value: string) => extractFirst(value, /G-[A-Z0-9]+/);

const cleanGoogleManagerIds = (value: string) => {
    const upper = value.toUpperCase();
    const ids = [
        upper.match(/GTM-[A-Z0-9]+/)?.[0],
        upper.match(/AW-[0-9]+/)?.[0],
    ].filter((id): id is string => Boolean(id));
    return [...new Set(ids)].join(", ");
};

const cleanMetaPixelId = (value: string) =>
    value.trim().match(/^[0-9]{5,25}$/)?.[0] ?? "";

export default function IntegracoesPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tracking, setTracking] = useState({
        ga4_id: "",
        gtm_id: "",
        meta_pixel_id: "",
        is_enabled: true,
    });
    const [showToast, setShowToast] = useState(false);
    const [toastConfig, setToastConfig] = useState<{
        message: string;
        type: "success" | "error";
    }>({ message: "", type: "success" });

    const showMessage = (message: string, type: "success" | "error") => {
        setToastConfig({ message, type });
        setShowToast(true);
    };

    useEffect(() => {
        const loadTracking = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            let resolvedRestaurantId = restaurantId;
            if (!resolvedRestaurantId) {
                const { data } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();
                if (!data) {
                    setLoading(false);
                    return;
                }
                resolvedRestaurantId = String(data.id);
                setRestaurantId(resolvedRestaurantId);
            }

            const { data } = await supabase
                .from("tracking_integrations")
                .select("*")
                .eq("restaurant_id", resolvedRestaurantId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setTracking({
                    ga4_id: cleanGa4Id(data.ga4_id || ""),
                    gtm_id: cleanGoogleManagerIds(
                        `${data.gtm_id || ""} ${data.ga4_id || ""}`
                    ),
                    meta_pixel_id: cleanMetaPixelId(data.meta_pixel_id || ""),
                    is_enabled: data.is_enabled,
                });
            }
            setLoading(false);
        };

        void loadTracking();
    }, [restaurantId, setRestaurantId]);

    const saveTracking = async () => {
        if (!restaurantId || saving) return;
        setSaving(true);

        const cleanTracking = {
            ga4_id: cleanGa4Id(tracking.ga4_id) || null,
            gtm_id: cleanGoogleManagerIds(tracking.gtm_id) || null,
            meta_pixel_id: cleanMetaPixelId(tracking.meta_pixel_id) || null,
            is_enabled: tracking.is_enabled,
        };
        const { error } = await supabase.from("tracking_integrations").upsert(
            {
                restaurant_id: restaurantId,
                ...cleanTracking,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "restaurant_id" }
        );

        if (error) {
            console.error("[TRACKING] Erro ao salvar integrações:", error);
            showMessage("Erro ao salvar integrações.", "error");
        } else {
            setTracking({
                ga4_id: cleanTracking.ga4_id || "",
                gtm_id: cleanTracking.gtm_id || "",
                meta_pixel_id: cleanTracking.meta_pixel_id || "",
                is_enabled: cleanTracking.is_enabled,
            });
            showMessage("Integrações salvas com sucesso!", "success");
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ListLoader lines={4} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Integrações</h1>
            <p className="mb-6 text-gray-600">
                Configure o rastreamento dos seus anúncios.
            </p>

            <Card className="space-y-6 border border-gray-200 p-7 pr-10">
                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                    Rastreamento de anúncios
                </h2>

                <div className="flex items-center gap-4">
                    <Image src="/logos/google-analytics.svg" alt="Google Analytics" width={36} height={36} />
                    <div className="flex-1">
                        <Input
                            label="Google Analytics (GA4)"
                            placeholder="G-XXXXXXXXXX"
                            value={tracking.ga4_id}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setTracking({ ...tracking, ga4_id: event.target.value })
                            }
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Use o ID da métrica que começa com G-. Não cole o código HTML completo.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Image src="/logos/google-tag-manager.svg" alt="Google Tag Manager" width={36} height={36} />
                    <div className="flex-1">
                        <Input
                            label="Google Tag Manager / Google Ads"
                            placeholder="GTM-XXXXXXX ou AW-XXXXXXXXXX"
                            value={tracking.gtm_id}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setTracking({ ...tracking, gtm_id: event.target.value })
                            }
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Aceita GTM-, AW- ou os dois separados por vírgula. Não cole o código HTML completo.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Image src="/logos/meta.svg" alt="Meta / Facebook" width={36} height={36} />
                    <div className="flex-1">
                        <Input
                            label="Meta (Facebook/Instagram) Pixel"
                            placeholder="123456789012345"
                            value={tracking.meta_pixel_id}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setTracking({ ...tracking, meta_pixel_id: event.target.value })
                            }
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            Acompanhe conversões e anúncios no Instagram e Facebook.
                        </p>
                    </div>
                </div>

                <div className="pt-4">
                    <Button onClick={saveTracking} loading={saving}>
                        Salvar Integrações
                    </Button>
                </div>
            </Card>

            {showToast && (
                <Toast
                    message={toastConfig.message}
                    type={toastConfig.type}
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
}

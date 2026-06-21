"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Toast from "@/components/ui/Toast";
import ListLoader from "@/components/ui/ListLoader";
import Card from "@/components/ui/Card";

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

    const [loading, setLoading] = useState(!restaurantId);
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
    }>({
        message: "",
        type: "success",
    });

    useEffect(() => {
        const loadRestaurantAndTracking = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user) return setLoading(false);

            let restId = restaurantId;

            if (!restId) {
                const { data: restaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();

                if (!restaurant) return setLoading(false);
                restId = restaurant.id;
                if (restId) setRestaurantId(restId);
            }

            const { data: trackingData } = await supabase
                .from("tracking_integrations")
                .select("*")
                .eq("restaurant_id", restId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (trackingData) {
                setTracking({
                    ga4_id: cleanGa4Id(trackingData.ga4_id || ""),
                    gtm_id: cleanGoogleManagerIds(
                        `${trackingData.gtm_id || ""} ${trackingData.ga4_id || ""}`
                    ),
                    meta_pixel_id: cleanMetaPixelId(
                        trackingData.meta_pixel_id || ""
                    ),
                    is_enabled: trackingData.is_enabled,
                });
            }

            setLoading(false);
        };

        loadRestaurantAndTracking();
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
            setToastConfig({
                message: "Erro ao salvar integrações.",
                type: "error",
            });
        } else {
            setTracking({
                ga4_id: cleanTracking.ga4_id || "",
                gtm_id: cleanTracking.gtm_id || "",
                meta_pixel_id: cleanTracking.meta_pixel_id || "",
                is_enabled: cleanTracking.is_enabled,
            });
            setToastConfig({
                message: "Integrações salvas com sucesso!",
                type: "success",
            });
        }

        setShowToast(true);
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <ListLoader lines={4} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-24">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Integrações
            </h1>

            <p className="text-gray-600 mb-8">
                Conecte ferramentas externas para rastreamento, anúncios e
                análises. Atualização automática, em segundos.
            </p>

            <Card className="border border-gray-200 p-7 pr-10 space-y-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-900">
                    Analytics e Rastreamento
                </h2>

                {/* Google Analytics */}
                <div className="flex gap-4 items-center">
                    <Image
                        src="/logos/google-analytics.svg"
                        alt="Google Analytics"
                        width={36}
                        height={36}
                    />
                    <div className="flex-1">
                        <Input
                            label="Google Analytics (GA4)"
                            placeholder="G-XXXXXXXXXX"
                            value={tracking.ga4_id}
                            onChange={(e) =>
                                setTracking({
                                    ...tracking,
                                    ga4_id: e.target.value,
                                })
                            }
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Use o ID da métrica que começa com G-. Não cole o
                            código HTML completo.
                        </p>
                    </div>
                </div>

                {/* Google Tag Manager / Google Ads */}
                <div className="flex gap-4 items-center">
                    <Image
                        src="/logos/google-tag-manager.svg"
                        alt="Google Tag Manager"
                        width={36}
                        height={36}
                    />
                    <div className="flex-1">
                        <Input
                            label="Google Tag Manager / Google Ads"
                            placeholder="GTM-XXXXXXX ou AW-XXXXXXXXXX"
                            value={tracking.gtm_id}
                            onChange={(e) =>
                                setTracking({
                                    ...tracking,
                                    gtm_id: e.target.value,
                                })
                            }
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Aceita GTM-, AW- ou os dois separados por vírgula.
                            Não cole o código HTML completo.
                        </p>
                    </div>
                </div>

                {/* Meta / Facebook Pixel */}
                <div className="flex gap-4 items-center">
                    <Image
                        src="/logos/meta.svg"
                        alt="Meta / Facebook"
                        width={36}
                        height={36}
                    />
                    <div className="flex-1">
                        <Input
                            label="Meta (Facebook/Instagram) Pixel"
                            placeholder="123456789012345"
                            value={tracking.meta_pixel_id}
                            onChange={(e) =>
                                setTracking({
                                    ...tracking,
                                    meta_pixel_id: e.target.value,
                                })
                            }
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Acompanhe conversões e anúncios no Instagram e
                            Facebook.
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

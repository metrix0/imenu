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
            const { data: { session } } = await supabase.auth.getSession();
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
                if(restId) setRestaurantId(restId);
            }

            const { data: trackingData } = await supabase
                .from("tracking_integrations")
                .select("*")
                .eq("restaurant_id", restId)
                .single();

            if (trackingData) {
                setTracking({
                    ga4_id: trackingData.ga4_id || "",
                    gtm_id: trackingData.gtm_id || "",
                    meta_pixel_id: trackingData.meta_pixel_id || "",
                    is_enabled: trackingData.is_enabled,
                });
            }

            setLoading(false);
        };

        loadRestaurantAndTracking();
    }, [restaurantId, setRestaurantId]);

    const saveTracking = async () => {
        if (!restaurantId) return;

        setSaving(true);

        const { error } = await supabase
            .from("tracking_integrations")
            .upsert({
                restaurant_id: restaurantId,
                ...tracking,
                updated_at: new Date().toISOString(),
            });

        console.log(error)

        if (error) {
            setToastConfig({
                message: "Erro ao salvar integrações.",
                type: "error",
            });
        } else {
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
                Conecte ferramentas externas para rastreamento, anúncios e análises. Atualização automática, em segundos.
            </p>

            {/* ============================
               Analytics e Rastreamento
            ============================ */}
            <Card className="border border-gray-200 p-7 pr-10 space-y-6">
                <h2 className="text-xl font-semibold mb-2text-gray-900">
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
                                setTracking({ ...tracking, ga4_id: e.target.value })
                            }
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Rastreie visitas e comportamento no cardápio digital.
                        </p>
                    </div>
                </div>

                {/* Google Tag Manager */}
                <div className="flex gap-4 items-center">
                    <Image
                        src="/logos/google-tag-manager.svg"
                        alt="Google Tag Manager"
                        width={36}
                        height={36}
                    />
                    <div className="flex-1">
                        <Input
                            label="Google Tag Manager"
                            placeholder="GTM-XXXXXXX"
                            value={tracking.gtm_id}
                            onChange={(e) =>
                                setTracking({ ...tracking, gtm_id: e.target.value })
                            }
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Ideal para integrações avançadas e agências.
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

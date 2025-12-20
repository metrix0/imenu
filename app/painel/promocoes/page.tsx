"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import {Restaurant} from "@/lib/types/types";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import ListLoader from "@/components/ui/ListLoader";

import CouponsList from "@/components/restaurant-owner/promocoes/CouponsList";
import CouponForm from "@/components/restaurant-owner/promocoes/CouponForm";
import {notFound} from "next/navigation";


export default function PromocoesPage() {

    const { restaurantId, setRestaurantId } = useCreationStore();

    const [restaurant, setRestaurant] = useState<any>({id: restaurantId || '', url_slug: ''});
    const [loading, setLoading] = useState(!restaurantId);
    const [tab, setTab] = useState("Cupons");
    const [showForm, setShowForm] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<any>(null);

    const [showToast, setShowToast] = useState(false);
    const [toastConfig, setToastConfig] = useState<{ message: string; type: "success" | "error" }>({
        message: "",
        type: "success",
    });

    useEffect(() => {
        const loadRestaurant = async () => {
            if (restaurantId) {
                setLoading(false);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return setLoading(false);

            const { data } = await supabase
                .from("restaurants")
                .select("id, url_slug")
                .eq("user_id", session.user.id)
                .single();


            if (data) {setRestaurantId(data.id);
            setRestaurant ({
                    id: data.id,
                    url_slug: data.url_slug
                })
            }
            setLoading(false);
        };

        loadRestaurant();
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        const loadRestaurant = async () => {
            if (restaurant.url_slug !== '') {
                setLoading(false);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return setLoading(false);

            const { data } = await supabase
                .from("restaurants")
                .select("url_slug")
                .eq("user_id", session.user.id)
                .single();


            if(data){
                setRestaurant({
                    id: restaurantId || '',
                    url_slug: data.url_slug
                })
            }
            }
            setLoading(false);

        loadRestaurant();
    }, [restaurantId, setRestaurantId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <ListLoader lines={4} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-24">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Promoções</h1>

            <Tabs
                tabs={["Cupons"]}
                active={tab}
                onChange={(t) => {
                    setTab(t);
                    setShowForm(false);
                    setEditingCoupon(null);
                }}
            />

            {tab === "Cupons" && !showForm && (
                <CouponsList
                    restaurantId={restaurantId!}
                    onCreate={() => setShowForm(true)}
                    onEdit={(coupon) => {
                        setEditingCoupon(coupon);
                        setShowForm(true);
                    }}
                    onToast={(message, type) => {
                        setToastConfig({ message, type });
                        setShowToast(true);
                    }}
                    restaurant={restaurant}
                />
            )}

            {tab === "Cupons" && showForm && (
                <CouponForm
                    restaurantId={restaurantId!}
                    initialData={editingCoupon}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingCoupon(null);
                    }}
                    onSaved={() => {
                        setShowForm(false);
                        setEditingCoupon(null);
                        setToastConfig({ message: "Cupom salvo com sucesso!", type: "success" });
                        setShowToast(true);
                    }}
                    onError={(message: string) => {
                        setToastConfig({ message, type: "error" });
                        setShowToast(true);
                    }}
                    restaurant={restaurant}
                />
            )}

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

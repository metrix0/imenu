"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import DeliveryRules from "@/components/restaurant-owner/configuracoes/TempoeTaxa";
import AddressForm from "@/components/restaurant-owner/configuracoes/AddressForm";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { AddressData } from "@/lib/types/types";

export default function PainelTempoETaxaPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [address, setAddress] = useState<Partial<AddressData>>({});
    const [editingAddress, setEditingAddress] = useState(false);
    const [savingAddress, setSavingAddress] = useState(false);
    const [addressSaved, setAddressSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            let id = restaurantId;

            if (!id) {
                console.log("➡️ Painel Tempo e Taxa: Buscando restaurante...");
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.user) {
                    console.log("❌ Sem usuário logado");
                    setIsLoading(false);
                    return;
                }

                const { data: restaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();

                if (!restaurant) {
                    console.log("❌ Restaurante não encontrado.");
                    setIsLoading(false);
                    return;
                }

                id = restaurant.id;
                setRestaurantId(restaurant.id);
                console.log("✅ Restaurante encontrado:", restaurant.id);
            }

            const { data: restaurantData } = await supabase
                .from("restaurants")
                .select("address,latitude,longitude")
                .eq("id", id)
                .single();

            if (restaurantData) {
                setAddress({
                    ...(restaurantData.address || {}),
                    latitude: restaurantData.latitude,
                    longitude: restaurantData.longitude,
                });
            }

            setIsLoading(false);
        };

        void load();
    }, [restaurantId, setRestaurantId]);

    const saveAddress = async (data: AddressData) => {
        if (!restaurantId) return;

        setSavingAddress(true);
        setAddressSaved(false);

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address: data,
                    latitude: data.latitude,
                    longitude: data.longitude,
                }),
            });

            if (!response.ok) throw new Error();

            setAddress(data);
            setEditingAddress(false);
            setAddressSaved(true);
        } catch {
            alert("Não foi possível salvar o endereço. Tente novamente.");
        } finally {
            setSavingAddress(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader /></div>;
    }

    if (!restaurantId) {
        return <div className="p-8 text-center text-gray-500">Restaurante não encontrado.</div>;
    }

    const addressLine = [
        address.street,
        address.number,
        address.neighborhood,
        address.city,
        address.state,
    ].filter(Boolean).join(", ");

    return (
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
            <div className="mb-8 flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-gray-900">Configurações de Entrega</h1>
                <p className="mt-1 text-gray-500 2xl:text-lg">Defina suas faixas de entrega e o valor mínimo de pedido.</p>
            </div>

            <DeliveryRules
                restaurantId={restaurantId}
                isNew={false}
            />

            <section className="mt-10 border-t border-gray-200 pt-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Endereço do restaurante</h2>
                        <p className="mt-1 text-sm text-gray-500">Este endereço é usado como origem para as regras de entrega.</p>
                    </div>

                    {!editingAddress && (
                        <Button
                            type="button"
                            onClick={() => {
                                setAddressSaved(false);
                                setEditingAddress(true);
                            }}
                            className="w-full sm:w-auto"
                        >
                            Alterar endereço
                        </Button>
                    )}
                </div>

                {!editingAddress ? (
                    <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {addressLine || "Endereço não cadastrado."}
                    </div>
                ) : (
                    <div className="mt-6 rounded-md border border-gray-200 bg-white p-4 sm:p-6">
                        <AddressForm
                            embedded
                            initialData={address}
                            onSubmit={saveAddress}
                            isLoading={savingAddress}
                            onValidityChange={() => {}}
                            submitLabel="Salvar endereço"
                        />
                        <button
                            type="button"
                            onClick={() => setEditingAddress(false)}
                            disabled={savingAddress}
                            className="mt-3 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {addressSaved && (
                    <p className="mt-3 text-sm font-medium text-green-700">Endereço atualizado.</p>
                )}
            </section>
        </div>
    );
}

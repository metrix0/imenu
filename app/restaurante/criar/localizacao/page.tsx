"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import DeliveryRules, {
    DeliveryRulesRef,
} from "@/components/restaurant-owner/configuracoes/TempoeTaxa";
import AddressForm from "@/components/restaurant-owner/configuracoes/AddressForm";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { AddressData } from "@/lib/types/types";

const hasCompleteAddress = (address: Partial<AddressData>) =>
    [
        address.cep,
        address.state,
        address.city,
        address.neighborhood,
        address.street,
        address.number,
    ].every((value) => String(value || "").trim());

export default function LocalizacaoPage() {
    const router = useRouter();
    const { setRestaurantId, clear } = useCreationStore();
    const [restaurantId, setId] = useState<string | null>(null);
    const [address, setAddress] = useState<Partial<AddressData>>({});
    const [editingAddress, setEditingAddress] = useState(false);
    const [addressSaved, setAddressSaved] = useState(false);
    const [savingAddress, setSavingAddress] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const rulesRef = useRef<DeliveryRulesRef>(null);

    useEffect(() => {
        void (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/restaurante/login");
                return;
            }

            const { data: restaurant, error } = await supabase
                .from("restaurants")
                .select("id,address,latitude,longitude")
                .eq("user_id", session.user.id)
                .single();

            if (error || !restaurant) {
                setToast({
                    message: "Restaurante não encontrado.",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            const initialAddress = {
                ...(restaurant.address || {}),
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
            } as Partial<AddressData>;

            setId(restaurant.id);
            setRestaurantId(restaurant.id);
            setAddress(initialAddress);
            setEditingAddress(!hasCompleteAddress(initialAddress));
            setLoading(false);
        })();
    }, [router, setRestaurantId]);

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
            setToast({
                message: "Não foi possível salvar o endereço. Tente novamente.",
                type: "error",
            });
        } finally {
            setSavingAddress(false);
        }
    };

    const addressLine = [
        address.street,
        address.number,
        address.neighborhood,
        address.city,
        address.state,
    ]
        .filter(Boolean)
        .join(", ");
    const addressComplete = hasCompleteAddress(address);
    const addressBlocked = !addressComplete || editingAddress;

    const finish = async () => {
        if (!restaurantId || !rulesRef.current || addressBlocked) return;

        setSaving(true);
        try {
            await rulesRef.current.save();
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_time: false,
                    creation_step: 4,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || "Erro ao finalizar cadastro.");
            }

            clear();
            router.replace("/painel");
        } catch (caught) {
            setToast({
                message:
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível salvar as configurações.",
                type: "error",
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-[50vh] items-center justify-center">
                <Loader className="border-t-brand" />
            </main>
        );
    }

    if (!restaurantId) return null;

    return (
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6 [&_h2>div.relative]:ml-2">
            <div className="mb-8 text-center sm:text-left">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
                    Etapa 4/4
                </p>
                <h1 className="text-3xl font-bold text-gray-900">
                    Configurações de Entrega
                </h1>
                <p className="mt-1 text-gray-500 2xl:text-lg">
                    Defina suas faixas de entrega e o valor mínimo de pedido.
                </p>
            </div>

            <DeliveryRules
                ref={rulesRef}
                restaurantId={restaurantId}
                isNew={false}
            />

            <section className="mt-10 border-t border-gray-200 pt-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Endereço do restaurante
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Este endereço é usado como origem para as regras de entrega.
                        </p>
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
                        {addressComplete && (
                            <button
                                type="button"
                                onClick={() => setEditingAddress(false)}
                                disabled={savingAddress}
                                className="mt-3 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                )}

                {addressSaved && (
                    <p className="mt-3 text-sm font-medium text-green-700">
                        Endereço atualizado.
                    </p>
                )}
            </section>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <button
                        onClick={() => router.push("/restaurante/criar/loja")}
                        className="cursor-pointer font-medium text-brand"
                    >
                        Voltar
                    </button>
                    <Tooltip
                        text={
                            !addressComplete
                                ? "Preencha o endereço do restaurante"
                                : editingAddress
                                  ? "Salve o endereço antes de continuar"
                                  : ""
                        }
                    >
                        <Button
                            onClick={finish}
                            loading={saving}
                            disabled={addressBlocked || saving}
                            className="px-8"
                        >
                            Salvar e Continuar
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </main>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import Loader from "@/components/ui/Loader";
import CardapioTab from "@/components/restaurant-owner/cardapio/tabs/CardapioTab";
import ManageCategoryModal from "@/components/restaurant-owner/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurant-owner/cardapio/ItemDetailsModal";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import ScanMenuModal from "@/components/restaurant-owner/ScanMenuImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

type Category = { id: string; name: string; position: number };

export default function CriarCardapioPage() {
    const router = useRouter();
    const { restaurantId } = useCreationStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);
    const [catOpen, setCatOpen] = useState(false);
    const [catEdit, setCatEdit] = useState<{ id: string; name: string } | null>(null);
    const [itemOpen, setItemOpen] = useState(false);
    const [itemEdit, setItemEdit] = useState<MenuItemType | null>(null);
    const [aiOpen, setAiOpen] = useState(false);

    const load = async () => {
        if (!restaurantId) return router.replace("/restaurante/login");

        try {
            const [{ data: cats }, { data: rawItems }] = await Promise.all([
                supabase
                    .from("categories")
                    .select("*")
                    .eq("restaurant_id", restaurantId)
                    .order("position"),
                supabase
                    .from("items")
                    .select("*")
                    .eq("restaurant_id", restaurantId)
                    .order("position"),
            ]);

            setCategories(cats || []);
            setItems(
                (rawItems || []).map((item: any) => ({
                    ...item,
                    image_url: item.image_path
                        ? supabase.storage
                              .from("menu-images")
                              .getPublicUrl(item.image_path).data.publicUrl
                        : null,
                }))
            );
        } catch (caught) {
            setToast({
                message:
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível carregar o cardápio.",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [restaurantId]);

    const continueOnboarding = async () => {
        if (!restaurantId) return;
        setSaving(true);

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creation_step: 2 }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || "Erro ao salvar.");
            }
            router.push("/restaurante/criar/disponibilidade");
        } catch (caught) {
            setToast({
                message:
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível continuar.",
                type: "error",
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center">
                <Loader className="border-t-brand" />
            </main>
        );
    }

    if (!restaurantId) return null;

    return (
        <main className="flex min-h-screen flex-col items-center bg-white px-4 pb-32 pt-4 sm:px-6">
            <div className="mt-4 w-full max-w-4xl">
                <div className="mb-8 text-center sm:text-left">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
                        Etapa 1/4
                    </p>
                    <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                    <p className="mt-1 text-gray-500">
                        Adicione seus primeiros produtos.
                    </p>
                </div>

                <div className="mb-4 flex flex-col justify-between gap-3 px-2 sm:flex-row sm:items-center">
                    <h2 className="text-xl font-bold">Cardápio</h2>
                    <button
                        onClick={() => setAiOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#905CFF] to-[#6A3AFF] px-6 py-3 font-medium text-white"
                    >
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                        Scanear Cardápio com IA
                    </button>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                    <CardapioTab
                        categories={categories}
                        items={items}
                        restaurantId={restaurantId}
                        onRefresh={load}
                        onItemUpdated={(updatedItem) =>
                            setItems((current) =>
                                current.map((item) =>
                                    item.id === updatedItem.id
                                        ? { ...item, ...updatedItem }
                                        : item
                                )
                            )
                        }
                        onEditCategory={(category) => {
                            setCatEdit(category);
                            setCatOpen(true);
                        }}
                        onOpenItemDetails={(item) => {
                            setItemEdit(item);
                            setItemOpen(true);
                        }}
                        onNewCategory={() => {
                            setCatEdit(null);
                            setCatOpen(true);
                        }}
                        onAIScanMenu={setAiOpen}
                    />
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="cursor-pointer font-medium text-brand"
                    >
                        Voltar
                    </button>
                    <Button
                        onClick={continueOnboarding}
                        loading={saving}
                        className="px-8"
                    >
                        Salvar e Continuar
                    </Button>
                </div>
            </div>

            <ManageCategoryModal
                isOpen={catOpen}
                onClose={() => setCatOpen(false)}
                onSuccess={load}
                restaurantId={restaurantId}
                categoryToEdit={catEdit}
            />
            <ItemDetailsModal
                isOpen={itemOpen}
                onClose={() => setItemOpen(false)}
                item={itemEdit}
                restaurantId={restaurantId}
            />
            <ScanMenuModal
                open={aiOpen}
                onClose={() => setAiOpen(false)}
                restaurantId={restaurantId}
                existingCategories={categories}
                onRefresh={load}
            />
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

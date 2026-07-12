"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Loader from "@/components/ui/Loader";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";

import CardapioTab from "@/components/restaurant-owner/cardapio/tabs/CardapioTab";
import ProdutosTab from "@/components/restaurant-owner/cardapio/tabs/ProdutosTab";
import ComplementosTab from "@/components/restaurant-owner/cardapio/tabs/ComplementosTab";
import UpsellTab from "@/components/restaurant-owner/cardapio/tabs/UpsellTab";
import EstoqueTab from "@/components/restaurant-owner/cardapio/tabs/EstoqueTabs";

import ManageCategoryModal from "@/components/restaurant-owner/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurant-owner/cardapio/ItemDetailsModal";
import ScanMenuModal from "@/components/restaurant-owner/ScanMenuImageModal";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; position: number };

const TABS = [
    "Cardápio",
    "Produtos",
    "Complemento",
    "Upsells",
    "Promoções e Cupons",
    "Estoque",
];

export default function MenuManagerPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();

    const [activeTab, setActiveTab] = useState("Cardápio");
    const [isLoading, setIsLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);
    const [toast, setToast] = useState<{
        message: string;
        type?: "success" | "error" | "info";
    } | null>(null);

    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] =
        useState<MenuItemType | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);

    const router = useRouter();

    useEffect(() => {
        if (activeTab === "Promoções e Cupons") {
            router.push("/painel/promocoes");
        }
    }, [activeTab, router]);

    const loadMenuData = async (id: string) => {
        setIsLoading(true);

        try {
            const [catsRes, itemsRes] = await Promise.all([
                supabase
                    .from("categories")
                    .select("*")
                    .eq("restaurant_id", id)
                    .order("position", { ascending: true }),
                supabase
                    .from("items")
                    .select("*")
                    .eq("restaurant_id", id)
                    .order("position", { ascending: true }),
            ]);

            if (catsRes.error) throw catsRes.error;
            if (itemsRes.error) throw itemsRes.error;

            setCategories(catsRes.data || []);

            const itemsWithUrls = (itemsRes.data || []).map((item: any) => {
                const publicUrl = item.image_path
                    ? supabase.storage
                          .from("menu-images")
                          .getPublicUrl(item.image_path).data.publicUrl
                    : null;

                return { ...item, image_url: publicUrl };
            });

            setItems(itemsWithUrls as MenuItemType[]);
        } catch (error) {
            console.error("Erro ao carregar cardápio:", error);
            setToast({ message: "Erro ao carregar dados.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            if (restaurantId) {
                await loadMenuData(restaurantId);
                return;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                setIsLoading(false);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                setRestaurantId(restaurant.id);
            } else {
                setIsLoading(false);
            }
        };

        void init();
    }, [restaurantId, setRestaurantId]);

    const handleNewCategory = () => {
        setCategoryToEdit(null);
        setIsCatModalOpen(true);
    };

    const handleEditCategory = (category: Category) => {
        setCategoryToEdit(category);
        setIsCatModalOpen(true);
    };

    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };

    const handleAddNewProduct = () => {
        if (categories.length === 0) {
            setToast({
                message: "Crie uma categoria antes de adicionar produtos.",
                type: "info",
            });
            setActiveTab("Cardápio");
            return;
        }

        setActiveTab("Cardápio");
        setToast({
            message: "Adicione o produto na categoria desejada.",
            type: "info",
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader />
            </div>
        );
    }

    if (!restaurantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
                <p>Restaurante não encontrado.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl 2xl:max-w-8xl mx-auto pb-32 space-y-8 px-4 pt-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                <p className="text-gray-500 mt-1 2xl:text-lg">
                    Defina quais os itens seus clientes podem pedir.
                </p>
            </div>

            <div className="border-b border-gray-200">
                <Tabs
                    tabs={TABS}
                    active={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className="pt-4">
                {activeTab === "Cardápio" && (
                    <CardapioTab
                        categories={categories}
                        items={items}
                        restaurantId={restaurantId}
                        onRefresh={() => loadMenuData(restaurantId)}
                        onEditCategory={handleEditCategory}
                        onOpenItemDetails={handleOpenItemDetails}
                        onNewCategory={handleNewCategory}
                        onAIScanMenu={setAiModalOpen}
                    />
                )}

                {activeTab === "Produtos" && (
                    <ProdutosTab
                        items={items}
                        onRefresh={() => loadMenuData(restaurantId)}
                        onOpenItemDetails={handleOpenItemDetails}
                        onAddNewProduct={handleAddNewProduct}
                    />
                )}

                {activeTab === "Complemento" && (
                    <ComplementosTab
                        restaurantId={restaurantId}
                        onOpenItemDetails={handleOpenItemDetails}
                    />
                )}

                {activeTab === "Upsells" && (
                    <UpsellTab restaurantId={restaurantId} items={items} />
                )}

                {activeTab === "Estoque" && (
                    <EstoqueTab
                        items={items}
                        categories={categories}
                        restaurantId={restaurantId}
                        onRefresh={() => loadMenuData(restaurantId)}
                        onToast={(
                            message: string,
                            type: "success" | "error" | "info" = "info"
                        ) => setToast({ message, type })}
                    />
                )}
            </div>

            <ManageCategoryModal
                isOpen={isCatModalOpen}
                onClose={() => setIsCatModalOpen(false)}
                onSuccess={() => loadMenuData(restaurantId)}
                restaurantId={restaurantId}
                categoryToEdit={categoryToEdit}
            />

            <ItemDetailsModal
                isOpen={isItemDetailsOpen}
                onClose={() => setIsItemDetailsOpen(false)}
                item={itemToEditDetails}
                restaurantId={restaurantId}
            />

            <ScanMenuModal
                open={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                restaurantId={restaurantId}
                existingCategories={categories}
                onRefresh={() => loadMenuData(restaurantId)}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}

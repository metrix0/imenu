"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Loader from "@/components/ui/Loader";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";

import CardapioTab from "@/components/restaurant-owner/cardapio/tabs/CardapioTab";
import ComplementosTab from "@/components/restaurant-owner/cardapio/tabs/ComplementosTab";
import UpsellTab from "@/components/restaurant-owner/cardapio/tabs/UpsellTab";
import EstoqueTab from "@/components/restaurant-owner/cardapio/tabs/EstoqueTabs";

import ManageCategoryModal from "@/components/restaurant-owner/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurant-owner/cardapio/ItemDetailsModal";
import ScanMenuModal from "@/components/restaurant-owner/ScanMenuImageModal";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import type { Category } from "@/lib/types/types";

const TABS = [
    "Cardápio",
    "Complementos",
    "Upsells",
    "Estoque",
];

export default function MenuManagerPage() {
    const router = useRouter();
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
    const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] =
        useState<MenuItemType | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiPlusOpen, setAiPlusOpen] = useState(false);
    const [scanAccess, setScanAccess] = useState<{ allowed: boolean; hasItems: boolean; hasPlus: boolean } | null>(null);

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

    useEffect(() => {
        if (!restaurantId || items.length < 2) {
            setScanAccess(null);
            return;
        }
        let canceled = false;
        setScanAccess(null);
        void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            const response = await fetch(`/api/scan-menu?restaurantId=${encodeURIComponent(restaurantId)}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: "no-store",
            });
            if (!response.ok) throw new Error("Não foi possível verificar o acesso ao scanner.");
            const access = await response.json();
            if (!canceled) setScanAccess(access);
        })().catch(error => console.error("[SCAN_MENU] Access check failed:", error));
        return () => { canceled = true; };
    }, [restaurantId, items.length]);

    const scanLocked = items.length >= 2 && scanAccess?.allowed === false;
    const openScanner = () => {
        if (scanLocked) setAiPlusOpen(true);
        else setAiModalOpen(true);
    };

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

    const handleItemUpdated = (updatedItem: MenuItemType) => {
        setItems((current) =>
            current.map((item) =>
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
            )
        );
    };

    const handleStockUpdated = (
        itemId: string,
        updates: {
            stock_enabled?: boolean;
            stock_quantity?: number | null;
            is_available?: boolean;
        }
    ) => {
        setItems((current) =>
            current.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
            )
        );
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
        <div className="mx-auto w-full min-w-0 max-w-full overflow-x-clip px-4 pb-32 pt-8 space-y-8 md:max-w-6xl 2xl:max-w-8xl">
            <style>{`
                .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input:focus-visible {
                    outline: none !important;
                    outline-offset: 0 !important;
                    box-shadow: none !important;
                }
                .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor.animate-fadeUp {
                    animation: none !important;
                }
                .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor {
                    min-height: 80px;
                    opacity: 1 !important;
                    transform: none !important;
                    box-shadow: none !important;
                    transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease !important;
                }
                .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-row {
                    min-height: 80px;
                }
                @media (max-width: 767px) {
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor > div:first-child {
                        width: 100%;
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input:not([type="file"]) {
                        font-size: 14px !important;
                        line-height: 20px !important;
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input[aria-label^="Estoque de "] {
                        font-size: 16px !important;
                        transform: scale(0.875);
                        transform-origin: right center;
                        width: calc(3rem / 0.875);
                        margin-left: calc(3rem - (3rem / 0.875));
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input[placeholder="Adicionar uma descrição..."] {
                        font-size: 12px !important;
                        line-height: 16px !important;
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input[placeholder="Nome do item"],
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor input[placeholder="Adicionar uma descrição..."] {
                        min-width: 0 !important;
                        max-width: calc(100% - 20px) !important;
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor div:has(> input[type="number"]) {
                        min-width: 72px;
                        justify-content: flex-end;
                    }
                    .panel-essencial [data-panel-path="/painel/cardapio"] .panel-menu-editor > div:last-child {
                        width: 100%;
                        justify-content: flex-end;
                        gap: 8px;
                        padding-left: 0;
                    }
                }
            `}</style>

            <div className="flex min-w-0 max-w-full flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                    <p className="text-gray-500 mt-1 2xl:text-lg">
                        Defina quais os itens seus clientes podem pedir.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => router.push("/painel/assistente-ia?revisao-cardapio=1")}
                >
                    <Sparkles size={16} aria-hidden="true" />
                    Analisar meu cardápio com IA
                </Button>
            </div>

            <div className="max-w-full overflow-hidden border-b border-gray-200">
                <Tabs
                    tabs={TABS}
                    active={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className="min-w-0 max-w-full overflow-x-clip pt-4">
                {activeTab === "Cardápio" && (
                    <CardapioTab
                        categories={categories}
                        items={items}
                        restaurantId={restaurantId}
                        onRefresh={() => loadMenuData(restaurantId)}
                        onItemUpdated={handleItemUpdated}
                        onEditCategory={handleEditCategory}
                        onOpenItemDetails={handleOpenItemDetails}
                        onNewCategory={handleNewCategory}
                        onAIScanMenu={openScanner}
                        scanLocked={scanLocked}
                    />
                )}

                {activeTab === "Complementos" && (
                    <ComplementosTab restaurantId={restaurantId} />
                )}

                {activeTab === "Upsells" && (
                    <UpsellTab restaurantId={restaurantId} items={items} />
                )}

                {activeTab === "Estoque" && (
                    <EstoqueTab
                        items={items}
                        categories={categories}
                        restaurantId={restaurantId}
                        onStockUpdated={handleStockUpdated}
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
                onOpenBulkComplements={() => {
                    setIsItemDetailsOpen(false);
                    setActiveTab("Complementos");
                }}
            />

            <ScanMenuModal
                open={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                restaurantId={restaurantId}
                existingCategories={categories}
                onRefresh={() => loadMenuData(restaurantId)}
                onUpgrade={() => { setAiModalOpen(false); setAiPlusOpen(true); }}
            />
            <IaPlusSalesModal
                open={aiPlusOpen}
                onClose={() => setAiPlusOpen(false)}
                restaurantId={restaurantId}
                contextMessage="Seu cardápio não está vazio. Para escanear novos itens com IA, remova os itens atuais ou assine o iMenu Plus"
                onPaid={() => { setAiPlusOpen(false); setScanAccess({ allowed: true, hasItems: true, hasPlus: true }); setAiModalOpen(true); }}
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

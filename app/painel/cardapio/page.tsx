"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Loader from "@/components/ui/Loader";
import Tabs from "@/components/ui/Tabs";
import Toast from "@/components/ui/Toast";

// Componentes de Aba
import CardapioTab from "@/components/restaurante/cardapio/tabs/CardapioTab";
import ProdutosTab from "@/components/restaurante/cardapio/tabs/ProdutosTab";
import ComplementosTab from "@/components/restaurante/cardapio/tabs/ComplementosTab";

// Modais e Tipos
import ManageCategoryModal from "@/components/restaurante/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurante/cardapio/ItemDetailsModal";
import { MenuItemType } from "@/components/restaurante/cardapio/MenuItemRow";

type Category = { id: string; name: string; position: number };

const TABS = ["Cardápio", "Produtos", "Complemento"];

export default function MenuManagerPage() {
    // 1. Usa Zustand para ID imediato
    const { restaurantId, setRestaurantId } = useCreationStore();
    
    const [activeTab, setActiveTab] = useState("Cardápio");
    const [isLoading, setIsLoading] = useState(true);
    
    // Dados locais
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

    // Modais
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] = useState<MenuItemType | null>(null);

    // Função para carregar dados do MENU (categorias e itens)
    const loadMenuData = async (id: string) => {
        setIsLoading(true);
        try {
            // Paraleliza as requisições para performance
            const [catsRes, itemsRes] = await Promise.all([
                supabase.from("categories").select("*").eq("restaurant_id", id).order("position", { ascending: true }),
                supabase.from("items").select("*").eq("restaurant_id", id).order("position", { ascending: true })
            ]);

            setCategories(catsRes.data || []);

            // Processa URLs de imagem
            const itemsWithUrls = (itemsRes.data || []).map((item: any) => {
                let publicUrl = null;
                if (item.image_path) {
                    publicUrl = supabase.storage.from("menu-images").getPublicUrl(item.image_path).data.publicUrl;
                }
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

    // Inicialização Inteligente
    useEffect(() => {
        const init = async () => {
            // Se já temos ID no Zustand, carrega direto
            if (restaurantId) {
                loadMenuData(restaurantId);
                return;
            }

            // Fallback: Busca via Auth
            const { data: { session } } = await supabase.auth.getSession();
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
                setRestaurantId(restaurant.id); // Salva no Zustand
                // O useEffect disparará novamente quando restaurantId mudar, chamando loadMenuData
            } else {
                setIsLoading(false);
            }
        };

        init();
    }, [restaurantId, setRestaurantId]); // Dependência em restaurantId garante reload se o ID mudar

    // Handlers
    const handleNewCategory = () => { setCategoryToEdit(null); setIsCatModalOpen(true); };
    const handleEditCategory = (cat: Category) => { setCategoryToEdit(cat); setIsCatModalOpen(true); };
    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };
    
    const handleAddNewProduct = () => {
        if (categories.length === 0) {
            setToast({ message: "Crie uma categoria antes de adicionar produtos.", type: "info" });
            setActiveTab("Cardápio");
            return;
        }
        setActiveTab("Cardápio");
        setToast({ message: "Adicione o produto na categoria desejada.", type: "info" });
    };

    // Renderização
    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader /></div>;
    
    if (!restaurantId) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
            <p>Restaurante não encontrado.</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-32 space-y-8 px-4 pt-8">
             {/* Header */}
             <div>
                <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                <p className="text-gray-500 mt-1">Defina quais os itens seus clientes podem pedir.</p>
             </div>

             {/* Tabs */}
             <div className="border-b border-gray-200">
                <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
             </div>

             {/* Content */}
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
             </div>

             {/* Modais Globais */}
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
            />

             {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
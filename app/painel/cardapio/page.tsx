"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import Tabs from "@/components/ui/Tabs"; // Seu componente de Tabs
import Toast from "@/components/ui/Toast";

// Novos Componentes de Aba
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
    const [activeTab, setActiveTab] = useState("Cardápio");
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

    // Modais
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] = useState<MenuItemType | null>(null);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (!restaurant) return;
            setRestaurantId(restaurant.id);

            const { data: cats } = await supabase.from("categories").select("*").eq("restaurant_id", restaurant.id).order("position", { ascending: true });
            setCategories(cats || []);

            const { data: rawItems } = await supabase.from("items").select("*").eq("restaurant_id", restaurant.id).order("position", { ascending: true });
            
            const itemsWithUrls = (rawItems || []).map((item: any) => {
                let publicUrl = null;
                if (item.image_path) {
                    publicUrl = supabase.storage.from("menu-images").getPublicUrl(item.image_path).data.publicUrl;
                }
                return { ...item, image_url: publicUrl };
            });
            setItems(itemsWithUrls as MenuItemType[]);

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Handlers
    const handleNewCategory = () => { setCategoryToEdit(null); setIsCatModalOpen(true); };
    const handleEditCategory = (cat: Category) => { setCategoryToEdit(cat); setIsCatModalOpen(true); };
    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };
    
    const handleAddNewProduct = () => {
        // Se estiver na aba Produtos e não tiver categoria, precisa forçar criação de categoria primeiro
        if (categories.length === 0) {
            setToast({ message: "Crie uma categoria antes de adicionar produtos.", type: "info" });
            setActiveTab("Cardápio");
            return;
        }
        // Lógica ideal: Abrir um modal de "Novo Produto" que pede Nome, Preço e Categoria.
        // Para MVP: Redireciona para a primeira categoria na aba Cardápio e abre criação
        setActiveTab("Cardápio");
        setToast({ message: "Adicione o produto na categoria desejada.", type: "info" });
        // Futuro: Implementar modal global de criação de produto
    };

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;
    if (!restaurantId) return <div className="p-8 text-red-500">Restaurante não encontrado.</div>;

    return (
        <div className="max-w-6xl mx-auto pb-32 space-y-8">
             
             {/* Header */}
             <div>
                <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                <p className="text-gray-500 mt-1">Defina quais os itens seus clientes podem pedir.</p>
             </div>

             {/* Tabs Navigation */}
             <div className="border-b border-gray-200">
                <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
             </div>

             {/* Tab Content */}
             <div className="pt-4">
                {activeTab === "Cardápio" && (
                    <CardapioTab 
                        categories={categories}
                        items={items}
                        restaurantId={restaurantId}
                        onRefresh={loadData}
                        onEditCategory={handleEditCategory}
                        onOpenItemDetails={handleOpenItemDetails}
                        onNewCategory={handleNewCategory}
                    />
                )}

                {activeTab === "Produtos" && (
                    <ProdutosTab 
                        items={items}
                        onRefresh={loadData}
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
             <ManageCategoryModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} onSuccess={loadData} restaurantId={restaurantId} categoryToEdit={categoryToEdit} />
             <ItemDetailsModal isOpen={isItemDetailsOpen} onClose={() => setIsItemDetailsOpen(false)} item={itemToEditDetails} />

             {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
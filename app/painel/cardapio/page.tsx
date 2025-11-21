"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

// Componentes
import HeaderManager from "@/components/restaurante/cardapio/HeaderManager";
import CategorySection from "@/components/restaurante/cardapio/CategorySection";
import { MenuItemType } from "@/components/restaurante/cardapio/MenuItemRow";
import ManageCategoryModal from "@/components/restaurante/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurante/cardapio/ItemDetailsModal";

type Category = { id: string; name: string; position: number };

export default function MenuManagerPage() {
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    // Guardamos os dados do restaurante para passar pro HeaderManager
    const [restaurantData, setRestaurantData] = useState<{name: string, logo_url: string | null, banner_url?: string | null} | null>(null);
    
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);

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
                .select("id, name, logo_url, banner_url")
                .eq("user_id", session.user.id)
                .single();

            if (!restaurant) return;
            setRestaurantId(restaurant.id);
            setRestaurantData(restaurant as any);

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

    // Callback quando o HeaderManager atualiza (ex: mudou logo)
    const handleHeaderUpdate = () => {
        setToast({ message: "Loja atualizada com sucesso!", type: "success" });
        loadData(); // Recarrega para atualizar visualmente
    };

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;
    if (!restaurantId) return <div className="p-8 text-red-500">Restaurante não encontrado.</div>;

    return (
        <div className="max-w-4xl mx-auto pb-32">
             
             {/* Componente Header Manager */}
             <HeaderManager 
                restaurantId={restaurantId} 
                initialData={restaurantData} 
                onUpdate={handleHeaderUpdate} 
             />

             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 px-2 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Cardápio</h1>
                    <p className="text-gray-500 mt-1">Gerencie seus produtos e a aparência da sua loja.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Button variant="secondary" onClick={handleNewCategory} className="flex-1 sm:flex-none">Nova Categoria</Button>
                    <Button onClick={() => window.open(`/restaurante/${restaurantId}`, '_blank')} className="flex-1 sm:flex-none">Ver Loja</Button>
                </div>
             </div>

             <div className="space-y-2">
                {categories.length === 0 && items.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-4">Comece criando uma categoria.</p>
                        <Button onClick={handleNewCategory}>Criar Primeira Categoria</Button>
                    </div>
                ) : (
                    categories.map(category => (
                        <CategorySection 
                            key={category.id}
                            category={category}
                            items={items.filter(i => i.category_id === category.id)}
                            restaurantId={restaurantId}
                            onRefresh={loadData} 
                            onEditCategory={() => handleEditCategory(category)}
                            onOpenItemDetails={handleOpenItemDetails} 
                        />
                    ))
                )}
             </div>

             {items.filter(i => !i.category_id).length > 0 && (
                 <div className="mt-12 border-t-2 border-dashed border-gray-200 pt-8 opacity-70 hover:opacity-100 transition-opacity">
                     <h3 className="text-gray-500 font-bold mb-4 uppercase text-xs tracking-wider px-2">Itens sem categoria</h3>
                     <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                        {items.filter(i => !i.category_id).map(item => (
                             <div key={item.id} className="p-4 border-b border-gray-200 flex justify-between"><span>{item.name}</span><span className="text-red-500 text-xs cursor-pointer">Excluir</span></div>
                        ))}
                     </div>
                 </div>
             )}

             <ManageCategoryModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} onSuccess={loadData} restaurantId={restaurantId} categoryToEdit={categoryToEdit} />
             
             <ItemDetailsModal isOpen={isItemDetailsOpen} onClose={() => setIsItemDetailsOpen(false)} item={itemToEditDetails} />

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
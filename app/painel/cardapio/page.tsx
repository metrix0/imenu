"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

import { uploadBannerImage } from "@/lib/uploadBannerImage";
import { uploadLogoImage } from "@/lib/uploadLogoImage";

import CategorySection from "@/components/restaurante/cardapio/CategorySection";
import { MenuItemType } from "@/components/restaurante/cardapio/MenuItemRow";
import ManageCategoryModal from "@/components/restaurante/cardapio/ManageCategoryModal";
// IMPORTAR O MODAL DE DETALHES
import ItemDetailsModal from "@/components/restaurante/cardapio/ItemDetailsModal";

type Category = { id: string; name: string; position: number };

export default function MenuManagerPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [restaurantData, setRestaurantData] = useState<{name: string, logo_url: string | null, banner_url?: string | null} | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);

    // Uploads
    const [isBannerUploading, setIsBannerUploading] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Modais
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
    
    // Estado do Modal de Complementos
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] = useState<MenuItemType | null>(null);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id, name, logo_url, banner_url") // Verifique se banner_url existe no seu DB
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

    // Handlers de Upload
    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!restaurantId || !e.target.files?.[0]) return;
        setIsBannerUploading(true);
        try {
            const path = await uploadBannerImage(e.target.files[0]);
            await supabase.from("restaurants").update({ banner_url: path } as any).eq("id", restaurantId);
            alert("Banner atualizado!");
            loadData();
        } catch (error) { alert("Erro ao enviar banner."); } 
        finally { setIsBannerUploading(false); }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!restaurantId || !e.target.files?.[0]) return;
        setIsLogoUploading(true);
        try {
            const path = await uploadLogoImage(e.target.files[0]);
            await supabase.from("restaurants").update({ logo_url: path }).eq("id", restaurantId);
            loadData();
        } catch (error) { alert("Erro ao enviar logo."); } 
        finally { setIsLogoUploading(false); }
    };

    // Handlers de Modal
    const handleNewCategory = () => { setCategoryToEdit(null); setIsCatModalOpen(true); };
    const handleEditCategory = (cat: Category) => { setCategoryToEdit(cat); setIsCatModalOpen(true); };
    
    // Handler para abrir detalhes do item
    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };

    const getBannerUrl = () => restaurantData?.banner_url ? supabase.storage.from("menu-banners").getPublicUrl(restaurantData.banner_url).data.publicUrl : null;
    const getLogoUrl = () => restaurantData?.logo_url ? supabase.storage.from("restaurant-logos").getPublicUrl(restaurantData.logo_url).data.publicUrl : null;

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;
    if (!restaurantId) return <div className="p-8 text-red-500">Restaurante não encontrado.</div>;

    return (
        <div className="max-w-4xl mx-auto pb-32">
             <div className="relative h-48 bg-gray-100 rounded-xl mb-16 group cursor-pointer overflow-hidden border border-gray-200 shadow-sm" onClick={() => bannerInputRef.current?.click()}>
                 <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />
                 {isBannerUploading ? (
                     <div className="absolute inset-0 flex items-center justify-center bg-gray-200"><FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-gray-400" /></div>
                 ) : getBannerUrl() ? (
                     <img src={getBannerUrl()!} alt="Capa" className="w-full h-full object-cover" />
                 ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2"><FontAwesomeIcon icon={icons.faGripLines} className="text-3xl opacity-20" /></div>
                 )}
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 drop-shadow-md"><FontAwesomeIcon icon={icons.faEdit} /> Alterar Capa</span>
                 </div>
                 <div className="absolute bottom-5 left-8 w-24 h-24 bg-white rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 cursor-pointer overflow-hidden hover:brightness-95 transition-all" onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}>
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    {isLogoUploading ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-brand" /> : getLogoUrl() ? <img src={getLogoUrl()!} alt="Logo" className="w-full h-full object-cover" /> : <FontAwesomeIcon icon={icons.faStore} className="text-2xl text-gray-300" />}
                 </div>
             </div>

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
                            onOpenItemDetails={handleOpenItemDetails} // CONEXÃO FEITA
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
             
             {/* MODAL DE DETALHES */}
             <ItemDetailsModal isOpen={isItemDetailsOpen} onClose={() => setIsItemDetailsOpen(false)} item={itemToEditDetails} />
        </div>
    );
}
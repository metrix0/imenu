"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore"; 
import { supabase } from "@/lib/supabaseClient"; 
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

// --- IMPORTANDO OS NOVOS COMPONENTES MODULARES ---
import StoreVisuals from "@/components/restaurante/loja/StoreVisuals";
import StoreName from "@/components/restaurante/loja/StoreName";

// Componentes do Cardápio
import CardapioTab from "@/components/restaurante/cardapio/tabs/CardapioTab";
import ManageCategoryModal from "@/components/restaurante/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurante/cardapio/ItemDetailsModal";
import { MenuItemType } from "@/components/restaurante/cardapio/MenuItemRow";
import ListLoader from "@/components/ui/ListLoader";
import Card from "@/components/ui/Card";

type Category = { id: string; name: string; position: number };

type RestaurantVisuals = { 
    logo_url: string | null; 
    banner_url: string | null; 
};

export default function CriarCardapioPage() {
    const router = useRouter();
    const { restaurantId, email } = useCreationStore(); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type?: "success" | "error" | "info" } | null>(null);

    const [visuals, setVisuals] = useState<RestaurantVisuals>({ logo_url: null, banner_url: null });
    const [name, setName] = useState(""); 
    
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);

    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{id: string, name: string} | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] = useState<MenuItemType | null>(null);

    // Validação Simples: Nome é obrigatório
    const isFormValid = name.trim().length > 0;

    useEffect(() => {
        if (!restaurantId) {
            router.replace("/restaurante");
            return;
        }
        loadData();
    }, [restaurantId, router]);

    const loadData = async () => {
        try {
            const { data: restaurant, error: rError } = await supabase
                .from("restaurants")
                .select("id, name, logo_url, banner_url")
                .eq("id", restaurantId)
                .single();

            if (rError || !restaurant) throw new Error("Restaurante não encontrado.");
            
            setName(restaurant.name || "");
            
            const logoPublic = restaurant.logo_url ? supabase.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url).data.publicUrl : null;
            const bannerPublic = restaurant.banner_url ? supabase.storage.from("menu-banners").getPublicUrl(restaurant.banner_url).data.publicUrl : null;
            
            setVisuals({
                logo_url: logoPublic,
                banner_url: bannerPublic
            });

            const { data: cats } = await supabase
                .from("categories")
                .select("*")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });
            setCategories(cats || []);

            const { data: rawItems } = await supabase
                .from("items")
                .select("*")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });
            
            const itemsWithUrls = (rawItems || []).map((item: any) => {
                let publicUrl = null;
                if (item.image_path) {
                    publicUrl = supabase.storage.from("menu-images").getPublicUrl(item.image_path).data.publicUrl;
                }
                return { ...item, image_url: publicUrl };
            });
            setItems(itemsWithUrls as MenuItemType[]);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVisualUpdate = (type: "logo" | "banner", url: string) => {
        setVisuals(prev => ({
            ...prev,
            [type === "logo" ? "logo_url" : "banner_url"]: url
        }));
        setToast({ message: "Imagem atualizada!", type: "success" });
    };

    const handleVisualError = (msg: string) => {
        setToast({ message: msg, type: "error" });
    };

    const handleNameBlur = async () => {
        if (!restaurantId || !name) return;
        try {
            await supabase.from("restaurants").update({ name }).eq("id", restaurantId);
        } catch (e) {
            console.error("Erro ao salvar nome:", e);
        }
    };

    const handleNewCategory = () => { setCategoryToEdit(null); setIsCatModalOpen(true); };
    const handleEditCategory = (cat: Category) => { setCategoryToEdit(cat); setIsCatModalOpen(true); };
    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };

    const handleContinue = async () => {
        // Validação redundante
        if (!isFormValid) return;

        if (!restaurantId || !email) {
            alert("Sessão expirada.");
            return;
        }
        setIsSaving(true);
        try {
            await supabase.from("restaurants").update({ name }).eq("id", restaurantId);

            const { error: authError } = await supabase.auth.signInWithOtp({
                email: email,
                options: { shouldCreateUser: false } 
            });

            if (authError) throw new Error(`Erro ao enviar código: ${authError.message}`);

            router.push("/restaurante/criar/info/otp");
        } catch (err) {
            console.error(err);
            setToast({ message: (err as Error).message, type: "error" });
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
            <div className="w-full max-w-3xl mt-12">
                <ListLoader lines={6} />
                <p className="text-center text-gray-500 mt-4">Carregando...</p>
            </div>
        </main>
    );
    
    if (error || !restaurantId) return <div className="p-8 text-center text-red-500">{error || "Erro."}</div>;

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white pb-32">
            <div className="w-full max-w-4xl mt-4">
                
                <div className="mb-8 text-center sm:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Defina sua Loja</h1>
                    <p className="text-gray-500">Adicione sua marca e seus primeiros produtos.</p>
                </div>

                <Card className="px-4 overflow-hidden mb-8 border border-gray-200 shadow-sm">
                    <StoreVisuals 
                        restaurantId={restaurantId}
                        logoUrl={visuals.logo_url}
                        bannerUrl={visuals.banner_url}
                        onUpdate={handleVisualUpdate}
                        onError={handleVisualError}
                    />

                    <div className="mb-12 -mt-6"> 
                        <StoreName 
                            value={name}
                            onChange={setName}
                            onBlur={handleNameBlur}
                        />

                    </div>
                </Card>

                <div className="flex justify-between items-center mb-4 px-2">
                    <h2 className="text-xl font-bold text-gray-800">Cardápio</h2>
                    <button disabled className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded cursor-not-allowed opacity-60">
                        Importar do iFood
                    </button>
                </div>

                <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-4">
                    <CardapioTab 
                        categories={categories}
                        items={items}
                        restaurantId={restaurantId}
                        onRefresh={loadData}
                        onEditCategory={handleEditCategory}
                        onOpenItemDetails={handleOpenItemDetails}
                        onNewCategory={handleNewCategory}
                    />
                </div>

            </div>

            {/* Footer Fixo */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => router.back()} 
                        className="text-brand font-medium text-base hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                        Voltar
                    </button>
                    
                    <Button
                        // Se não for válido, usa variante secundária (cinza/outline)
                        variant={isFormValid ? "primary" : "secondary"}
                        onClick={handleContinue}
                        // Desabilita se salvando OU inválido
                        disabled={isSaving || !isFormValid}
                        loading={isSaving}
                        className="px-8"
                    >
                        {isSaving ? "Salvando..." : "Salvar e Continuar"}
                    </Button>
                </div>
            </div>

            <ManageCategoryModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} onSuccess={loadData} restaurantId={restaurantId} categoryToEdit={categoryToEdit} />
            <ItemDetailsModal isOpen={isItemDetailsOpen} onClose={() => setIsItemDetailsOpen(false)} item={itemToEditDetails} />
            
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </main>
    );
}
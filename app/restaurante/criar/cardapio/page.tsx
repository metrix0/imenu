"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import StoreVisuals from "@/components/restaurant-owner/loja/StoreVisuals";
import StoreName from "@/components/restaurant-owner/loja/StoreName";
import CardapioTab from "@/components/restaurant-owner/cardapio/tabs/CardapioTab";
import ManageCategoryModal from "@/components/restaurant-owner/cardapio/ManageCategoryModal";
import ItemDetailsModal from "@/components/restaurant-owner/cardapio/ItemDetailsModal";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";
import ListLoader from "@/components/ui/ListLoader";
import Card from "@/components/ui/Card";
import ScanMenuModal from "@/components/restaurant-owner/ScanMenuImageModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";

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
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [paymentInfo, setPaymentInfo] = useState("");

    const isFormValid = name.trim().length > 0;

    const useHasHydrated = () => {
        const [hasHydrated, setHasHydrated] = useState(false);

        useEffect(() => {
            setHasHydrated(true);
        }, []);

        return hasHydrated;
    };
    const hydrated = useHasHydrated();


    useEffect(() => {
        if (!hydrated) return; // 👈 wait for hydration!
        console.log(restaurantId)
        if (!restaurantId) {
            router.replace("/restaurante/login");
        } else {
            loadData();
        }
    }, [hydrated, restaurantId]);


    const loadData = async () => {
        try {
            // Leitura permitida via Supabase Client (conforme CONVENTIONS.md)
            const { data: restaurant, error: rError } = await supabase
                .from("restaurants")
                .select("id, name, logo_url, banner_url, payment_method, payment_info")
                .eq("id", restaurantId)
                .single();

            if (rError || !restaurant) throw new Error("Restaurante não encontrado.");
            
            setName(restaurant.name || "");

            setPaymentMethod(restaurant.payment_method || "pix");
            setPaymentInfo(restaurant.payment_info || "");
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

    const autoSave = async (field: string, value: string) => {
        if (!restaurantId) return;
        try {
            await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });
        } catch (err) {
            console.error("Erro ao salvar pagamento:", err);
        }
    };

    // --- UPDATES VIA API (Conforme Arquitetura) ---

    const handleVisualUpdate = async (type: "logo" | "banner", publicUrl: string, dbPath: string) => {
        // Atualiza UI instantaneamente
        setVisuals(prev => ({
            ...prev,
            [type === "logo" ? "logo_url" : "banner_url"]: publicUrl
        }));

        try {
            const field = type === "logo" ? "logo_url" : "banner_url";
            
            // Chama API para salvar o path no banco
            const res = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: dbPath }),
            });

            if (!res.ok) throw new Error("Falha ao salvar imagem no banco.");

            setToast({ message: "Imagem salva com sucesso!", type: "success" });
        } catch (error) {
            console.error(error);
            setToast({ message: "Erro ao salvar imagem.", type: "error" });
        }
    };

    const handleNameBlur = async () => {
        if (!restaurantId || !name) return;
        try {
            const res = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error("Falha ao salvar nome");
        } catch (e) {
            console.error("Erro ao salvar nome:", e);
        }
    };

    const handleContinue = async () => {
        if (!isFormValid) return;
        if (!restaurantId || !email) {
            alert("Sessão expirada ou e-mail não encontrado.");
            router.push("/restaurante/login");
            return;
        }

        setIsSaving(true);
        try {
            // Garante que o nome está salvo antes de prosseguir
            await handleNameBlur();

            // Envia OTP (Email) - Conforme fluxo de registro
            // const { error: authError } = await supabase.auth.signInWithOtp({
            //     email: email,
            //     options: { shouldCreateUser: false } 
            // });

            // if (authError) throw new Error(`Erro ao enviar código: ${authError.message}`);

            router.push("/restaurante/criar/info/otp");
        } catch (err) {
            console.error(err);
            setToast({ message: (err as Error).message, type: "error" });
            setIsSaving(false);
        }
    };

    const handleNewCategory = () => { setCategoryToEdit(null); setIsCatModalOpen(true); };
    const handleEditCategory = (cat: Category) => { setCategoryToEdit(cat); setIsCatModalOpen(true); };
    const handleOpenItemDetails = (item: MenuItemType) => {
        setItemToEditDetails(item);
        setIsItemDetailsOpen(true);
    };

    const handleVisualError = (msg: string) => setToast({ message: msg, type: "error" });

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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 2xl:text-4xl">Defina sua Loja</h1>
                    <p className="text-gray-500 2xl:text-lg">Adicione sua marca e seus primeiros produtos.</p>
                </div>

                <Card className="px-4 overflow-hidden mb-8 2xl:mb-16 border border-gray-200 shadow-sm">
                    <StoreVisuals 
                        restaurantId={restaurantId}
                        logoUrl={visuals.logo_url}
                        bannerUrl={visuals.banner_url}
                        onUpdate={handleVisualUpdate}
                        onError={handleVisualError}
                    />

                    <div className="mt-4">
                        <StoreName 
                            value={name}
                            onChange={setName}
                            onBlur={handleNameBlur}
                        />
                    </div>

                    <div className={"flex gap-6 mb-4"}>
                        {/* MÉTODO DE PAGAMENTO */}
                        <Dropdown
                            label="Método de pagamento"
                            options={[
                                { value: "pix", label: "PIX" },
                            ]}
                            value={paymentMethod}
                            onChange={(e) => {
                                const method = (e.target.value as unknown) as "pix" | "deposit";
                                setPaymentMethod(method);
                            }}
                        />

                        {/* CAMPOS DINÂMICOS */}
                        {(paymentMethod !== "pix" || paymentMethod) ? (
                            <Input
                                label="Chave PIX"
                                placeholder="Ex: 123456789"
                                value={paymentInfo}
                                onChange={(e) => setPaymentInfo(e.target.value)}
                                onBlur={() => autoSave("payment_info", paymentInfo)}
                            />
                        ) : (
                            <Input
                                label="Dados para Depósito"
                                placeholder={`Banco, Agência, Conta, Tipo, Titular...`}
                                value={paymentInfo}
                                onChange={(e) => setPaymentInfo(e.target.value)}
                                onBlur={() => autoSave("payment_info", paymentInfo)}
                            />
                        )}
                    </div>

                </Card>

                <div className="flex justify-between items-center mb-4 2xl:mb-6 px-2">
                    <h2 className="text-xl font-bold text-gray-800 2xl:text-2xl">Cardápio</h2>
                    <button
                        onClick={() => setAiModalOpen(true)}
                        className={`
                relative
                flex items-center gap-2
                px-6 py-3
                rounded-full
                text-white font-medium
                transition-all duration-300
                active:scale-95
                overflow-hidden
                backdrop-blur-sm

                /* main gradient */
                bg-gradient-to-br from-[#905CFF] to-[#6A3AFF]
                cursor-pointer
                hover:shadow-[0_0_10px_rgba(137,88,255,0.25)]
                hover:from-[#A678FF] hover:to-[#7D4CFF]
            `}
                    >
                        {/* glossy highlight */}
                        <span
                            className="
                    absolute top-0 left-0 right-0 h-[35%]
                    bg-white/10
                    rounded-full
                    pointer-events-none
                "
                        />

                        {/* sparkles icon */}
                        <FontAwesomeIcon icon={faWandMagicSparkles} className="text-white text-sm relative z-10 2xl:text-xl" />

                        {/* label */}
                        <span className="relative z-10 2xl:text-lg">Scanear Cardápio com IA</span>

                        {/* ambient glow ring */}
                        <span
                            className="
                    absolute inset-0 rounded-full
                    bg-purple-500/20
                    blur-xl
                    opacity-60
                    -z-10
                "
                        />
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
                        onAIScanMenu={setAiModalOpen}
                    />
                </div>

            </div>

            {/* Footer Fixo */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 2xl:p-5 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="2xl:text-lg text-brand font-medium text-base hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                        Voltar
                    </button>

                    <Button
                        variant={isFormValid ? "primary" : "secondary"}
                        onClick={handleContinue}
                        disabled={isSaving || !isFormValid}
                        loading={isSaving}
                        className="px-8 2xl:px-10 2xl:py-4"
                    >
                        {isSaving ? "Salvando..." : "Salvar e Continuar"}
                    </Button>
                </div>
            </div>

            <ManageCategoryModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} onSuccess={loadData} restaurantId={restaurantId} categoryToEdit={categoryToEdit} />
            <ItemDetailsModal isOpen={isItemDetailsOpen} onClose={() => setIsItemDetailsOpen(false)} item={itemToEditDetails } restaurantId={restaurantId || ""} />
            <ScanMenuModal
                open={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                restaurantId={restaurantId}
                existingCategories={categories}
                onRefresh={loadData}
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </main>
    );
}
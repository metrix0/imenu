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
import {
    faWandMagicSparkles,
    faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import WarningBox from "@/components/ui/WarningBox";
import AllowedPaymentMethods, {
    DEFAULT_ALLOWED_PAYMENT_METHODS,
} from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";

type Category = { id: string; name: string; position: number };

type RestaurantVisuals = {
    logo_url: string | null;
    banner_url: string | null;
};

function formatPhone(value: string): string {
    let digits = value.replace(/\D/g, "");

    if (digits.startsWith("55") && digits.length > 11) {
        digits = digits.slice(2);
    }

    digits = digits.slice(0, 11);

    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function CriarCardapioPage() {
    const router = useRouter();
    const { restaurantId, email } = useCreationStore();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{
        message: string;
        type?: "success" | "error" | "info";
    } | null>(null);

    const [visuals, setVisuals] = useState<RestaurantVisuals>({
        logo_url: null,
        banner_url: null,
    });
    const [name, setName] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItemType[]>([]);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isItemDetailsOpen, setIsItemDetailsOpen] = useState(false);
    const [itemToEditDetails, setItemToEditDetails] =
        useState<MenuItemType | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>(
        DEFAULT_ALLOWED_PAYMENT_METHODS
    );
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [paymentInfo, setPaymentInfo] = useState("");
    const [storeWhatsapp, setStoreWhatsapp] = useState("");

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
        if (!hydrated) return;

        if (!restaurantId) {
            router.replace("/restaurante/login");
        } else {
            void loadData();
        }
    }, [hydrated, restaurantId, router]);

    const loadData = async () => {
        try {
            const { data: restaurant, error: restaurantError } = await supabase
                .from("restaurants")
                .select(
                    "id, name, logo_url, banner_url, allowed_payment_methods, payment_method, payment_info, store_whatsapp"
                )
                .eq("id", restaurantId)
                .single();

            if (restaurantError || !restaurant) {
                throw new Error("Restaurante não encontrado.");
            }

            setName(restaurant.name || "");
            setAllowedPaymentMethods(
                Array.isArray(restaurant.allowed_payment_methods) &&
                    restaurant.allowed_payment_methods.length > 0
                    ? restaurant.allowed_payment_methods
                    : DEFAULT_ALLOWED_PAYMENT_METHODS
            );
            setPaymentMethod(restaurant.payment_method || "pix");
            setPaymentInfo(restaurant.payment_info || "");
            setStoreWhatsapp(formatPhone(restaurant.store_whatsapp || ""));

            const logoPublic = restaurant.logo_url
                ? supabase.storage
                      .from("restaurant-logos")
                      .getPublicUrl(restaurant.logo_url).data.publicUrl
                : null;
            const bannerPublic = restaurant.banner_url
                ? supabase.storage
                      .from("menu-banners")
                      .getPublicUrl(restaurant.banner_url).data.publicUrl
                : null;

            setVisuals({
                logo_url: logoPublic,
                banner_url: bannerPublic,
            });

            const { data: categoriesData } = await supabase
                .from("categories")
                .select("*")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });

            setCategories(categoriesData || []);

            const { data: rawItems } = await supabase
                .from("items")
                .select("*")
                .eq("restaurant_id", restaurantId)
                .order("position", { ascending: true });

            const itemsWithUrls = (rawItems || []).map((item: any) => {
                const publicUrl = item.image_path
                    ? supabase.storage
                          .from("menu-images")
                          .getPublicUrl(item.image_path).data.publicUrl
                    : null;

                return { ...item, image_url: publicUrl };
            });

            setItems(itemsWithUrls as MenuItemType[]);
        } catch (caughtError) {
            setError((caughtError as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const autoSave = async (field: string, value: string | string[]) => {
        if (!restaurantId) return;

        try {
            const response = await fetch(
                `/api/restaurants/${restaurantId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [field]: value }),
                }
            );

            if (!response.ok) {
                const json = await response.json();
                throw new Error(json?.error || "Erro ao salvar.");
            }
        } catch (caughtError) {
            console.error("Erro ao salvar:", caughtError);
            setToast({
                message:
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Erro ao salvar.",
                type: "error",
            });
        }
    };

    const handleVisualUpdate = async (
        type: "logo" | "banner",
        publicUrl: string,
        dbPath: string
    ) => {
        setVisuals((previous) => ({
            ...previous,
            [type === "logo" ? "logo_url" : "banner_url"]: publicUrl,
        }));

        try {
            const field = type === "logo" ? "logo_url" : "banner_url";
            const response = await fetch(
                `/api/restaurants/${restaurantId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [field]: dbPath }),
                }
            );

            if (!response.ok) {
                throw new Error("Falha ao salvar imagem no banco.");
            }

            setToast({
                message: "Imagem salva com sucesso!",
                type: "success",
            });
        } catch (caughtError) {
            console.error(caughtError);
            setToast({ message: "Erro ao salvar imagem.", type: "error" });
        }
    };

    const handleNameBlur = async () => {
        if (!restaurantId || !name) return;

        await autoSave("name", name);
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
            await handleNameBlur();
            router.push("/restaurante/criar/info/otp");
        } catch (caughtError) {
            console.error(caughtError);
            setToast({
                message: (caughtError as Error).message,
                type: "error",
            });
            setIsSaving(false);
        }
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

    const handleAllowedPaymentMethodsChange = async (methods: string[]) => {
        setAllowedPaymentMethods(methods);
        await autoSave("allowed_payment_methods", methods);
    };

    const handleVisualError = (message: string) =>
        setToast({ message, type: "error" });

    if (isLoading) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
                <div className="w-full max-w-3xl mt-12">
                    <ListLoader lines={6} />
                    <p className="text-center text-gray-500 mt-4">
                        Carregando...
                    </p>
                </div>
            </main>
        );
    }

    if (error || !restaurantId) {
        return (
            <div className="p-8 text-center text-red-500">
                {error || "Erro."}
            </div>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white pb-32">
            <div className="w-full max-w-4xl mt-4">
                <div className="mb-8 text-center sm:text-left">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 2xl:text-4xl">
                        Defina sua Loja
                    </h1>
                    <p className="text-gray-500 2xl:text-lg">
                        Adicione sua marca e seus primeiros produtos.
                    </p>
                </div>

                <Card className="px-4 overflow-hidden mb-8 border border-gray-200 shadow-sm">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <Dropdown
                            label="Método de pagamento"
                            options={[{ value: "pix", label: "PIX" }]}
                            value={paymentMethod}
                            onChange={(event) => {
                                const nextMethod = event.target.value;
                                setPaymentMethod(nextMethod);
                                void autoSave(
                                    "payment_method",
                                    nextMethod
                                );
                            }}
                        />

                        <Input
                            label="Chave PIX"
                            placeholder="Ex: 123456789"
                            value={paymentInfo}
                            onChange={(event) =>
                                setPaymentInfo(event.target.value)
                            }
                            onBlur={() =>
                                autoSave("payment_info", paymentInfo)
                            }
                        />
                    </div>

                    <div className="mt-6">
                        <Input
                            label="WhatsApp da loja"
                            placeholder="(00) 00000-0000"
                            type="tel"
                            inputMode="tel"
                            value={storeWhatsapp}
                            onChange={(event) =>
                                setStoreWhatsapp(formatPhone(event.target.value))
                            }
                            onBlur={() =>
                                autoSave(
                                    "store_whatsapp",
                                    storeWhatsapp.replace(/\D/g, "")
                                )
                            }
                            maxLength={15}
                            autoComplete="tel"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Número público usado pelos clientes para falar com
                            o restaurante. Separado do número do gestor.
                        </p>
                    </div>

                    <WarningBox
                        icon={faCircleInfo}
                        className="bg-brand! text-white! mt-6 mb-2"
                    >
                        <b>AVISO:</b> Repasses de pagamentos em Pix (ONLINE)
                        são realizados semanalmente, sempre aos domingos a
                        partir das 14h. O repasse é realizado na Chave Pix
                        cadastrada acima.
                    </WarningBox>
                </Card>

                <AllowedPaymentMethods
                    value={allowedPaymentMethods}
                    onChange={handleAllowedPaymentMethodsChange}
                    className="mb-8"
                />

                <div className="flex justify-between items-center mb-4 2xl:mb-6 px-2">
                    <h2 className="text-xl font-bold text-gray-800 2xl:text-2xl">
                        Cardápio
                    </h2>

                    <button
                        onClick={() => setAiModalOpen(true)}
                        className="relative flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium transition-all duration-300 active:scale-95 overflow-hidden backdrop-blur-sm bg-gradient-to-br from-[#905CFF] to-[#6A3AFF] cursor-pointer hover:shadow-[0_0_10px_rgba(137,88,255,0.25)] hover:from-[#A678FF] hover:to-[#7D4CFF]"
                    >
                        <span className="absolute top-0 left-0 right-0 h-[35%] bg-white/10 rounded-full pointer-events-none" />
                        <FontAwesomeIcon
                            icon={faWandMagicSparkles}
                            className="text-white text-sm relative z-10 2xl:text-xl"
                        />
                        <span className="relative z-10 2xl:text-lg">
                            Scanear Cardápio com IA
                        </span>
                        <span className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl opacity-60 -z-10" />
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

            <ManageCategoryModal
                isOpen={isCatModalOpen}
                onClose={() => setIsCatModalOpen(false)}
                onSuccess={loadData}
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
                onRefresh={loadData}
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

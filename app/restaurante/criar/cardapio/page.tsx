"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore"; 
import { supabase } from "@/lib/supabaseClient"; 
import Link from "next/link";
import ListLoader from "@/components/ui/ListLoader";
import Button from "@/components/ui/Button";
import RestaurantIdentity from "@/components/restaurante/configuracoes/RestaurantIdentity";
import MenuOverview from "@/components/restaurante/configuracoes/MenuOverview";
import posthog from "posthog-js";

type Category = { id: string; name: string };
type Item = { id: string; name: string; category?: Category | null };
type Restaurant = { id: string; name: string; logo_url: string | null };

export default function CriarCardapioPage() {
    const router = useRouter();
    // Recuperamos ID e E-mail do estado global (Zustand)
    const { restaurantId, email } = useCreationStore(); 
    
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 1. Verificação de Segurança: Se não tem ID, volta pro início
        posthog.capture("admin_access_create_restaurant_menu_page", {
            page: "/restaurante/criar/cardapio",
            timestamp: new Date().toISOString(),
        });
    }, []);

    useEffect(() => {
        if (!restaurantId) {
            router.replace("/restaurante");
            return;
        }

        async function fetchData() {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/restaurants/${restaurantId}/creation-data`);
                if (!response.ok) throw new Error("Falha ao buscar dados.");
                
                const data = await response.json();
                setRestaurant(data.restaurant);
                setName(data.restaurant.name);
                setLogoUrl(data.restaurant.logo_url);
                setMenuId(data.menuId);
                setCategories(data.categories || []);
                setItems(data.items || []);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [restaurantId, router]);

    const handleContinue = async () => {
        if (!restaurantId) return;
        
        // 2. Verificação de Segurança: O e-mail é obrigatório para enviar o OTP
        if (!email) {
            alert("Sessão expirada. Por favor, inicie o cadastro novamente.");
            router.push("/restaurante");
            return;
        }

        setIsSaving(true);

        try {
            // A. Salva as alterações visuais (Nome do Restaurante)
            // Nota: Certifique-se que existe uma rota PATCH em /api/restaurants/[id] para isso funcionar
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name }),
            });

            if (!response.ok) throw new Error("Erro ao salvar dados do restaurante.");

            // B. DISPARO DO E-MAIL (OTP)
            // Usamos shouldCreateUser: false pois o usuário JÁ FOI CRIADO na etapa anterior.
            const { error: authError } = await supabase.auth.signInWithOtp({
                email: email,
                options: { shouldCreateUser: false } 
            });

            if (authError) throw new Error(`Erro ao enviar código: ${authError.message}`);

            // C. Redireciona para a tela de inserir o código
            router.push("/restaurante/criar/info/otp");

        } catch (err) {
            console.error(err);
            alert((err as Error).message);
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
                <div className="w-full max-w-3xl mt-12">
                    <ListLoader lines={6} />
                    <p className="text-center text-gray-500 mt-4">Carregando cardápio...</p>
                </div>
            </main>
        );
    }
    
    if (error || !restaurant || !menuId) {
        return (
             <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
                 <div className="w-full max-w-3xl mt-12 text-center">
                     <p className="text-red-500 mb-4">{error || "Não foi possível carregar o restaurante."}</p>
                     <Link href="/restaurante" className="text-brand underline">&larr; Voltar</Link>
                 </div>
             </main>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white pb-32">
            <div className="w-full max-w-3xl mt-8">
                <div className="w-full max-w-2xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Defina sua Loja</h1>
                        <p className="text-gray-500">Personalize como seu restaurante aparece.</p>
                    </div>

                    <RestaurantIdentity 
                        restaurantId={restaurantId}
                        name={name}
                        setName={setName}
                        logoUrl={logoUrl}
                        setLogoUrl={setLogoUrl}
                        className="mb-8"
                    />

                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Itens do Cardápio</h2>
                        {/* Botão desativado conforme design system */}
                        <button disabled className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded cursor-not-allowed opacity-60">
                            Importar do iFood
                        </button>
                    </div>

                    <MenuOverview 
                        menuId={menuId}
                        categories={categories}
                        items={items}
                        className="mb-8"
                    />
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => router.back()} 
                        className="text-brand font-medium text-base hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                        Voltar
                    </button>
                    
                    <Button
                        variant="primary"
                        onClick={handleContinue}
                        disabled={isSaving || !name}
                        loading={isSaving}
                        className="px-8 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? "Enviando Código..." : "Salvar e Continuar"}
                    </Button>
                </div>
            </div>
        </main>
    );
}
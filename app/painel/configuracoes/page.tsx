// app/painel/configuracoes/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { uploadLogoImage } from "@/lib/uploadLogoImage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import type { User } from "@supabase/supabase-js";

// Tipo de mensagem (corrigido da iteração anterior)
type MessageType = "error" | "success" | "info";

type Restaurant = {
    id: string;
    name: string;
    url_slug?: string | null;
    logo_url?: string | null;
    user_id?: string | null;
    // added fields for prep time
    prep_time_min_minutes?: number | null;
    prep_time_max_minutes?: number | null;
    prep_time_source?: "auto" | "manual" | null;
    prep_time_computed_at?: string | null;
};

type Menu = {
    id: string;
    name: string;
    description?: string | null;
    is_active?: boolean | null;
    banner_url?: string | null;
};

const loadScript = (src: string, onLoad: () => void) => {
    if (document.querySelector(`script[src="${src}"]`)) {
        onLoad();
        return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = onLoad;
    document.head.appendChild(script);
};

export default function ConfiguracoesPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeletingRestaurant, setIsDeletingRestaurant] = useState(false); // Renomeado para clareza
    const [isDeletingAccount, setIsDeletingAccount] = useState(false); // Novo estado
    const [message, setMessage] = useState<{ type: MessageType; content: string } | null>(null);

    // ESTADOS PARA MINHA CONTA
    const [userName, setUserName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    // FIM ESTADOS PARA MINHA CONTA

    const [shareableUrl, setShareableUrl] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [copySuccess, setCopySuccess] = useState("");
    const [hoveringLogo, setHoveringLogo] = useState(false);

    // Average Delivery Time Estimation (prep time)
    const [prepMode, setPrepMode] = useState<"auto" | "manual">("auto");
    const [manualMin, setManualMin] = useState<number | "">("");
    const [manualMax, setManualMax] = useState<number | "">("");
    const [computing, setComputing] = useState(false);
    const [updatingManual, setUpdatingManual] = useState(false);

    // Função central para buscar o restaurante pelo user_id e configurar o estado
    const fetchRestaurantByUserId = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("restaurants")
                .select(
                    "id, name, url_slug, logo_url, user_id, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at"
                )
                .eq("user_id", userId)
                .single(); // Usa single() pois cada user tem 1 restaurante

            if (error || !data) {
                console.warn("fetchRestaurantByUserId: restaurante não encontrado para o user_id", userId, error);
                // Garante que o estado está limpo se não houver restaurante
                setRestaurantId(null);
                setRestaurant(null);
                return null;
            }

            // Define o ID e o objeto do restaurante
            setRestaurantId(data.id);
            setRestaurant(data);

            // Inicia o Prep Time Mode
            if (data.prep_time_source === "manual") {
                setPrepMode("manual");
            } else if (data.prep_time_source === "auto") {
                setPrepMode("auto");
            } else {
                if (typeof data.prep_time_min_minutes === "number" && typeof data.prep_time_max_minutes === "number") {
                    setPrepMode("manual");
                } else {
                    setPrepMode("auto");
                }
            }

            setManualMin(typeof data.prep_time_min_minutes === "number" ? data.prep_time_min_minutes : "");
            setManualMax(typeof data.prep_time_max_minutes === "number" ? data.prep_time_max_minutes : "");

            return data.id;

        } catch (err) {
            console.error("Erro em fetchRestaurantByUserId:", err);
            return null;
        }
    };

    // 🔐 Carrega dados do usuário e do restaurante associado
    useEffect(() => {
        const loadUserAndRestaurant = async () => {
            setLoading(true);
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session) {
                    router.push("/admin/login");
                    return;
                }
                const currentUser = session.user;
                setUser(currentUser);

                // Define o nome inicial do usuário
                setUserName((currentUser.user_metadata as { full_name?: string })?.full_name || currentUser.email || "");

                // 1. Busca o restaurante do usuário
                const rId = await fetchRestaurantByUserId(currentUser.id);

                if (rId) {
                    // 2. Continua buscando o cardápio
                    const { data: menuData, error: menuError } = await supabase
                        .from("menu")
                        .select("id, name, description, is_active, banner_url")
                        .eq("restaurant_id", rId)
                        .maybeSingle();

                    if (!menuError && menuData) setMenu(menuData);

                    // 3. Gera URLs e QR Code
                    const slug = await getRestaurantSlug(rId);
                    const url = `${window.location.origin}/${slug}`;
                    setShareableUrl(url);

                    loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js", () => {
                        if ((window as any).QRCode) {
                            (window as any).QRCode.toDataURL(url, { width: 200, margin: 1 }, (err: any, dataUrl: string) => {
                                if (!err) setQrCodeUrl(dataUrl);
                            });
                        }
                    });
                } else {
                    // Garante que o estado de menu e urls está limpo
                    setMenu(null);
                    setShareableUrl("");
                    setQrCodeUrl("");
                    setMessage({ type: "info", content: "Nenhum restaurante encontrado para este usuário. Você ainda pode gerenciar sua conta e criar um restaurante." });
                }

            } catch (err) {
                console.error("Erro loadUserAndRestaurant configurações:", err);
                setMessage({ type: "error", content: "Erro ao carregar dados." });
            } finally {
                setLoading(false);
            }
        };

        loadUserAndRestaurant();

    }, [router]);

    // Função auxiliar para re-fetch, que agora usa o estado `restaurantId`
    const fetchRestaurant = async () => {
        if (!restaurantId) return null;
        try {
            const { data, error } = await supabase
                .from("restaurants")
                .select(
                    "id, name, url_slug, logo_url, user_id, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at"
                )
                .eq("id", restaurantId)
                .single();

            if (error || !data) {
                console.warn("fetchRestaurant: restaurante não encontrado", error);
                return null;
            }

            // Atualiza estado do restaurante
            setRestaurant(data);

            // Decide prepMode com base no campo source ou fallback pelos valores min/max
            if (data.prep_time_source === "manual") {
                setPrepMode("manual");
            } else if (data.prep_time_source === "auto") {
                setPrepMode("auto");
            } else {
                // se source não estiver definido, inferir manual se houver min/max preenchidos
                if (typeof data.prep_time_min_minutes === "number" && typeof data.prep_time_max_minutes === "number") {
                    setPrepMode("manual");
                } else {
                    setPrepMode("auto");
                }
            }

            // preencher inputs com os valores do banco (ou vazio)
            setManualMin(typeof data.prep_time_min_minutes === "number" ? data.prep_time_min_minutes : "");
            setManualMax(typeof data.prep_time_max_minutes === "number" ? data.prep_time_max_minutes : "");

            return data;
        } catch (err) {
            console.error("Erro em fetchRestaurant:", err);
            return null;
        }
    };

    // ----------- Lógica de Edição de Nome -----------

    const handleNameUpdate = async () => {
        if (userName.trim() === "") {
            setMessage({ type: "error", content: "O nome não pode ser vazio." });
            return;
        }
        if (userName.trim() === ((user?.user_metadata as { full_name?: string })?.full_name || user?.email)) {
            setIsEditingName(false); // Não faz nada se o nome não mudou
            return;
        }

        setIsUpdatingName(true);
        setMessage(null);

        try {
            const { data, error } = await supabase.auth.updateUser({
                data: { full_name: userName.trim() },
            });

            if (error) throw error;

            // Atualiza o estado local do usuário e o modo de edição
            setUser(data.user);
            setUserName((data.user.user_metadata as { full_name: string }).full_name);
            setIsEditingName(false);
            setMessage({ type: "success", content: "Nome atualizado com sucesso!" });

        } catch (error: any) {
            console.error("Erro ao atualizar nome:", error);
            setMessage({ type: "error", content: `Erro ao atualizar nome: ${error.message || "Tente novamente."}` });
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleInputClick = () => {
        setIsEditingName(true);
        // Garante que o input seja focado na próxima renderização
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleNameUpdate();
        } else if (e.key === 'Escape') {
            // Volta o nome para o valor original e sai do modo de edição
            setUserName((user?.user_metadata as { full_name?: string })?.full_name || user?.email || "");
            setIsEditingName(false);
        }
    };

    // ----------- FIM Lógica de Edição de Nome -----------

    // Função para tratar a resposta do Fetch (para evitar o erro de JSON)
    const safeJsonParse = async (res: Response) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return res.json();
        }
        // Se não for JSON, lê o texto e retorna um erro genérico
        const text = await res.text();
        console.error("Resposta não-JSON recebida:", text.substring(0, 200));
        throw new Error(`Resposta inesperada do servidor (status ${res.status}). Detalhe: ${text.substring(0, 50)}...`);
    }

    // 🗑️ Excluir restaurante (chama API server-side que remove storage + dados relacionados)
    const handleDeleteRestaurant = async () => {
        if (!restaurant) return;

        // Utilizamos o novo componente de Modal em vez de confirm()
        const modalConfirmed = await showCustomConfirmModal(
            `Deletar Restaurante "${restaurant.name}"`,
            "Tem certeza que deseja deletar o restaurante e TODOS os dados relacionados (cardápios, pedidos, etc.)? Essa ação é irreversível.",
            "Deletar Restaurante"
        );
        if (!modalConfirmed) return;

        setIsDeletingRestaurant(true);
        try {
            const res = await fetch("/api/restaurants/delete-restaurant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId: restaurant.id, userId: restaurant.user_id }), // Passamos o userId para segurança
            });

            // Tratamento de erro para resposta não-JSON
            const json = await safeJsonParse(res);

            if (!res.ok || json?.error) {
                console.error("Erro ao deletar restaurante:", json);
                setMessage({ type: "error", content: `Erro ao deletar restaurante: ${json?.error ?? json?.detail ?? "ver console"}` });
                setIsDeletingRestaurant(false);
                return;
            }
            setMessage({ type: "success", content: "Restaurante e dados relacionados deletados com sucesso." });

            // Após deletar o restaurante, redireciona para criar um novo
            router.push("/painel/configuracoes");
        } catch (err: any) {
            console.error("Erro ao deletar restaurante:", err);
            // Captura o erro do safeJsonParse
            setMessage({ type: "error", content: `Erro ao deletar: ${String(err.message)}` });
            setIsDeletingRestaurant(false);
        }
    };

    // 💥 NOVO: Deletar Conta (Apaga o usuário no Auth, que deve limpar o restante)
    const handleDeleteAccount = async () => {
        if (!user) return; // Precisa do usuário logado

        // Alerta de confirmação final
        const modalConfirmed = await showCustomConfirmModal(
            "DELETAR CONTA PERMANENTEMENTE",
            `Tem certeza absoluta que deseja deletar sua conta (${user.email})${restaurant ? ` e remover PERMANENTEMENTE TODOS os seus dados, incluindo o restaurante "${restaurant.name}", cardápios e pedidos` : ""}? Esta ação não pode ser desfeita.`,
            "SIM, DELETAR TUDO"
        );
        if (!modalConfirmed) return;

        setIsDeletingAccount(true);
        setMessage(null);

        try {
            // 1. **Deletar todos os dados relacionados ao restaurante primeiro (se existir)**
            if (restaurant) {
                const deleteRestaurantRes = await fetch("/api/restaurants/delete-restaurant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ restaurantId: restaurant.id, userId: user.id }),
                });

                const deleteRestJson = await safeJsonParse(deleteRestaurantRes);

                if (!deleteRestaurantRes.ok || deleteRestJson?.error) {
                    console.error("Erro ao limpar dados do restaurante antes de deletar a conta:", deleteRestJson);
                    throw new Error(`Falha na limpeza de dados do restaurante: ${deleteRestJson?.error ?? "Erro desconhecido"}`);
                }
            }


            // 2. **Deletar o usuário no Auth**
            // Precisamos do access_token atual para provar que o usuário está logado.
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;

            if (!accessToken) {
                throw new Error("Sessão não encontrada. Faça login novamente.");
            }

            const deleteAccountRes = await fetch("/api/auth/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: accessToken }),
            });

            // Tratamento de erro para resposta não-JSON
            const deleteAccountJson = await safeJsonParse(deleteAccountRes);

            if (!deleteAccountRes.ok || deleteAccountJson?.error) {
                console.error("Erro ao deletar conta:", deleteAccountJson);
                throw new Error(`Falha ao deletar conta: ${deleteAccountJson?.error ?? "Erro desconhecido"}`);
            }

            // 3. **Logout e Redirecionamento**
            await supabase.auth.signOut();
            setMessage({ type: "success", content: "Conta deletada com sucesso. Redirecionando..." });
            router.push("/"); // Redireciona para a home page pública ou tela de login
        } catch (err: any) {
            console.error("Erro final ao deletar conta:", err);
            setMessage({ type: "error", content: `Não foi possível deletar a conta completamente: ${String(err.message)}` });
            setIsDeletingAccount(false);
        }
    };


    // 📋 Copiar link
    const handleCopyLink = () => {
        if (!shareableUrl) return;
        // document.execCommand('copy') foi removido, use navigator.clipboard
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareableUrl);
        }
        setCopySuccess("Link copiado!");
        setTimeout(() => setCopySuccess(""), 2000);
    };

    // 📥 Baixar QR Code
    const handleDownloadQR = () => {
        if (!qrCodeUrl || !restaurant) return;
        const link = document.createElement("a");
        link.href = qrCodeUrl;
        link.download = `${restaurant.url_slug ?? "cardapio"}-qrcode.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 🖼️ Upload de logo
    const handleLogoClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && restaurant) {
            try {
                const key = await uploadLogoImage(file);
                const { error } = await supabase.from("restaurants").update({ logo_url: key }).eq("id", restaurant.id);
                if (error) throw error;
                setRestaurant({ ...restaurant, logo_url: key });
                setMessage({ type: "success", content: "Logo atualizada com sucesso!" });
            } catch (err: any) {
                setMessage({ type: "error", content: `Erro ao enviar logo: ${err?.message ?? err}` });
            }
        }
    };

    const handleLogoDelete = async () => {
        if (!restaurant?.logo_url) return;
        // Usando o componente de modal
        const modalConfirmed = await showCustomConfirmModal("Remover Logo", "Deseja remover a logo atual?", "Remover");
        if (!modalConfirmed) return;

        try {
            const key = restaurant.logo_url;
            const { error: storageErr } = await supabase.storage.from("restaurant-logos").remove([key]);
            if (storageErr) {
                console.error("Erro ao remover logo do storage:", storageErr);
                setMessage({ type: "error", content: `Erro ao remover arquivo do storage: ${storageErr.message}` });
                return;
            }

            const { error } = await supabase.from("restaurants").update({ logo_url: null }).eq("id", restaurant.id);
            if (error) {
                console.error("Erro ao atualizar restaurante após remoção de logo:", error);
                setMessage({ type: "error", content: `Erro ao atualizar registro: ${error.message}` });
                return;
            }

            setRestaurant({ ...restaurant, logo_url: null });
            setMessage({ type: "success", content: "Logo removida com sucesso!" });
        } catch (err: any) {
            console.error("Erro ao deletar logo:", err);
            setMessage({ type: "error", content: `Erro ao deletar logo: ${String(err?.message ?? err)}` });
        }
    };

    // Navega para a página de criação do cardápio (AddMenuClient fará a criação)
    const handleCreateMenu = () => {
        if (!restaurant) return;
        router.push(`/painel/${restaurant.id}/criar-cardapio`); // Mantendo o caminho com ID para criar cardápio
    };

    // Alterna disponibilidade do cardápio (cliente)
    const toggleMenuActive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!menu) return;
        try {
            const { error } = await supabase
                .from("menu")
                .update({ is_active: !menu.is_active })
                .eq("id", menu.id);
            if (error) throw error;
            setMenu({ ...menu, is_active: !menu.is_active });
            setMessage({ type: "success", content: "Disponibilidade do cardápio atualizada." });
        } catch (err: any) {
            console.error("Erro ao alternar disponibilidade do menu:", err);
            setMessage({ type: "error", content: `Erro ao atualizar disponibilidade: ${err?.message ?? err}` });
        }
    };

    // Excluir cardápio (usa API server-side para deletar com SERVICE ROLE)
    const handleDeleteMenu = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!menu) return;

        const modalConfirmed = await showCustomConfirmModal(
            `Excluir Cardápio "${menu.name}"`,
            "Excluir o cardápio e todos os itens relacionados? Esta ação é irreversível.",
            "Excluir Cardápio"
        );
        if (!modalConfirmed) return;

        try {
            const res = await fetch("/api/menu/delete-menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ menuId: menu.id }),
            });

            // Tratamento de erro para resposta não-JSON
            const json = await safeJsonParse(res);

            if (!res.ok || json?.error) {
                console.error("Erro ao deletar menu:", json);
                setMessage({ type: "error", content: "Erro ao deletar cardápio. Veja console." });
                return;
            }
            setMenu(null);
            setMessage({ type: "success", content: "Cardápio excluído com sucesso." });
        } catch (err: any) {
            console.error("Erro ao deletar menu:", err);
            setMessage({ type: "error", content: `Erro ao deletar: ${String(err.message)}` });
        }
    };

    // navegar para editar / visualizar cardápio
    const goToMenu = (menuId: string) => {
        if (!restaurantId) return;
        // abre a view administrativa do cardápio dentro do painel
        router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
    };

    // função auxiliar para obter slug (mantida separada para clareza)
    const getRestaurantSlug = async (id: string) => {
        const { data } = await supabase.from("restaurants").select("url_slug").eq("id", id).maybeSingle();
        return data?.url_slug ?? null;
    };


    // ---------- Prep time API interactions ----------
    const handleComputeNow = async () => {
        if (!restaurant) return;
        setComputing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
            const json = await safeJsonParse(res);
            if (!res.ok) throw json;

            await fetchRestaurant();

            setMessage({ type: "success", content: "Cálculo automático concluído." });
        } catch (err: any) {
            console.error("Erro compute-prep-time:", err);
            setMessage({ type: "error", content: "Erro ao calcular automaticamente." });
        } finally {
            setComputing(false);
        }
    };

    // Salva modo automático ou manual de forma unificada
    const handleSaveGeneral = async () => {
        if (!restaurant) return;
        setMessage(null);

        if (prepMode === "manual") {
            if (manualMin === "" || manualMax === "") {
                setMessage({ type: "error", content: "Informe mínimo e máximo." });
                return;
            }
            const min = Number(manualMin);
            const max = Number(manualMax);
            if (!min || !max || min <= 0 || max <= 0 || max <= min) {
                setMessage({ type: "error", content: "Valores inválidos. Max deve ser maior que Min e ambos positivos." });
                return;
            }
            if ((max - min) < 20) {
                setMessage({ type: "error", content: "A diferença entre máximo e mínimo deve ser ao menos 20 minutos." });
                return;
            }

            setUpdatingManual(true);
            try {
                const res = await fetch(`/api/restaurants/${restaurant.id}/set-prep-time`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ min, max, source: "manual" }),
                });
                const json = await safeJsonParse(res);
                if (!res.ok) throw json;

                await fetchRestaurant();

                setMessage({ type: "success", content: "Tempo de preparo salvo manualmente." });
            } catch (err: any) {
                console.error("Erro set-prep-time (manual):", err);
                setMessage({ type: "error", content: "Erro ao salvar tempo manual." });
            } finally {
                setUpdatingManual(false);
            }
        } else {
            setComputing(true);
            try {
                const res1 = await fetch(`/api/restaurants/${restaurant.id}/set-prep-time`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "auto" }),
                });
                const json1 = await safeJsonParse(res1);
                if (!res1.ok) throw json1;

                await fetchRestaurant();

                const res2 = await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
                // Não precisa de safeJsonParse aqui se o res2.ok for a única coisa importante
                if (res2.ok) {
                    await fetchRestaurant();
                }

                setMessage({ type: "success", content: "Modo automático salvo. Valores manuais removidos; cálculo automático acionado." });
            } catch (err: any) {
                console.error("Erro set-prep-time (auto):", err);
                setMessage({ type: "error", content: "Erro ao salvar modo automático." });
            } finally {
                setComputing(false);
            }
        }
    };
    // --------------------------------------------------

    // --------------------------------------------------
    // CUSTOM MODAL (Substitui alert() e confirm())
    // --------------------------------------------------
    const [modal, setModal] = useState<{ isOpen: boolean, title: string, message: string, buttonText: string, resolve: (confirmed: boolean) => void } | null>(null);

    const showCustomConfirmModal = (title: string, message: string, buttonText: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                buttonText,
                resolve,
            });
        });
    };

    const closeCustomModal = (confirmed: boolean) => {
        if (modal) {
            modal.resolve(confirmed);
            setModal(null);
        }
    };

    // --------------------------------------------------


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <p className="text-gray-600 text-lg">Carregando configurações...</p>
            </div>
        );
    }

    // função auxiliar para estilizar mensagens
    const getMessageClasses = (type: MessageType) => {
        switch (type) {
            case "success":
                return "bg-green-100 text-green-800 border border-green-300";
            case "error":
                return "bg-red-100 text-red-800 border border-red-300";
            case "info":
                return "bg-blue-100 text-blue-800 border border-blue-300";
            default:
                return "bg-gray-100 text-gray-800 border border-gray-300";
        }
    };

    // obter URL pública da logo (se houver)
    const logoPublicUrl =
        restaurant?.logo_url &&
        supabase.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url).data?.publicUrl;


    return (
        <>
            {/* Modal de Confirmação Personalizado */}
            {modal?.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">{modal.title}</h3>
                        <p className="text-sm text-gray-700">{modal.message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => closeCustomModal(false)}
                                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
                                disabled={isDeletingAccount}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => closeCustomModal(true)}
                                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                disabled={isDeletingAccount}
                            >
                                {modal.buttonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex min-h-screen flex-col items-center bg-gray-50 p-6">
                <div className="w-full max-w-2xl space-y-8">

                    {/* CABEÇALHO COM LOGO (Condicional) */}
                    <div className="flex flex-col items-center">
                        {restaurant && (
                            // LOGO DO RESTAURANTE
                            <div className="flex flex-col items-center mb-4">
                                <div
                                    className="relative w-28 h-28 rounded-full border-4 border-gray-300 overflow-hidden cursor-pointer group"
                                    onMouseEnter={() => setHoveringLogo(true)}
                                    onMouseLeave={() => setHoveringLogo(false)}
                                    onClick={handleLogoClick}
                                >
                                    {logoPublicUrl ? (
                                        <img src={logoPublicUrl} alt="Logo do restaurante" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-500 text-sm">
                                            Adicionar Logo
                                        </div>
                                    )}
                                    {hoveringLogo && restaurant.logo_url && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLogoDelete();
                                            }}
                                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white"
                                        >
                                            <FontAwesomeIcon icon={icons.faTrash} className="text-lg" />
                                        </button>
                                    )}
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                                </div>
                            </div>
                        )}

                        <h1 className="mt-1 text-3xl font-bold text-gray-900">Configurações</h1>
                        {restaurant ? (
                            <p className="text-lg text-gray-600">
                                Gerenciando: <span className="font-semibold">{restaurant.name}</span>
                            </p>
                        ) : (
                            <p className="text-lg text-gray-600">Gerenciando sua conta.</p>
                        )}
                    </div>
                    {/* FIM CABEÇALHO */}


                    {message && (
                        <div
                            className={`rounded-md p-3 text-sm font-medium ${getMessageClasses(message.type)}`}
                        >
                            {message.content}
                        </div>
                    )}

                    {/* MINHA CONTA - Renderizada sempre */}
                    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">Minha Conta</h2>
                        <p className="text-sm text-gray-700">Gerencie suas informações de login e perfil de administrador.</p>

                        {/* Campo Nome */}
                        <div className="space-y-2">
                            <label htmlFor="adminName" className="block text-sm font-medium text-gray-700">Nome do Administrador</label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="adminName"
                                    ref={nameInputRef}
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onFocus={handleInputClick}
                                    onBlur={handleNameUpdate} // Salva ao perder o foco (blur)
                                    onKeyDown={handleInputKeyDown} // Salva ao apertar Enter
                                    disabled={isUpdatingName}
                                    required
                                    className={`flex-grow rounded-md border-gray-300 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${isEditingName ? 'border-indigo-500' : 'border-gray-300'}`}
                                />
                                {(isEditingName || isUpdatingName) && (
                                    <button
                                        onClick={handleNameUpdate}
                                        disabled={isUpdatingName || userName.trim() === ((user?.user_metadata as { full_name?: string })?.full_name || user?.email || "") || userName.trim() === ""}
                                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 min-w-[70px]"
                                    >
                                        {isUpdatingName ? <FontAwesomeIcon icon={icons.faSpinner} spin /> : <FontAwesomeIcon icon={icons.faCheck} />}
                                    </button>
                                )}
                                {!isEditingName && !isUpdatingName && (
                                    <button
                                        onClick={handleInputClick}
                                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                                    >
                                        <FontAwesomeIcon icon={icons.faEdit} />
                                    </button>
                                )}
                            </div>
                            {isEditingName && !isUpdatingName && (
                                <p className="text-xs text-gray-500">Pressione Enter ou clique no <FontAwesomeIcon icon={icons.faCheck} /> para salvar.</p>
                            )}
                            {isUpdatingName && <p className="text-xs text-indigo-600">Atualizando nome...</p>}
                        </div>

                        {/* E-mail e Senha Buttons */}
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50">
                                <span className="text-sm text-gray-700">E-mail: <strong className="font-medium text-gray-900">{user?.email}</strong></span>
                                <button
                                    onClick={() => router.push("/painel/configuracoes/atualizar-email")}
                                    className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
                                >
                                    <FontAwesomeIcon icon={icons.faEnvelope} className="mr-1" /> Atualizar E-mail
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50">
                                <span className="text-sm text-gray-700">Senha: **********</span>
                                <button
                                    onClick={() => router.push("/painel/configuracoes/nova-senha")}
                                    className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
                                >
                                    <FontAwesomeIcon icon={icons.faLock} className="mr-1" /> Alterar Senha
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Exibe a mensagem de "Não há restaurante" e o botão de criar, OU as configurações do restaurante */}
                    {!restaurant ? (
                        <div className="space-y-4 rounded-lg border border-blue-300 bg-blue-50 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-blue-800">Crie seu Restaurante</h2>
                            <p className="text-sm text-blue-700">
                                Não encontramos nenhum restaurante associado a esta conta. Para começar a usar a plataforma, crie seu primeiro restaurante!
                            </p>
                            <button
                                onClick={() => router.push("/restaurante/criar")}
                                className="mt-3 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                            >
                                <FontAwesomeIcon icon={icons.faPlus} className="mr-2" /> Criar Restaurante Agora
                            </button>
                        </div>
                    ) : (
                        // AQUI COMEÇAM AS CONFIGURAÇÕES ESPECÍFICAS DO RESTAURANTE (SOMENTE SE restaurant EXISTE)
                        <>
                            {/* COMPARTILHAR */}
                            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-900">Compartilhar Cardápio</h2>
                                <p className="text-sm text-gray-700">Use o link direto ou QR Code para divulgar seu cardápio.</p>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="text"
                                        value={shareableUrl}
                                        readOnly
                                        className="flex-grow rounded-md border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
                                    >
                                        {copySuccess || "Copiar Link"}
                                    </button>
                                </div>

                                <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-gray-50 p-6">
                                    {qrCodeUrl ? (
                                        <img src={qrCodeUrl} alt="QR Code" width={200} height={200} className="rounded-md border border-gray-300" />
                                    ) : (
                                        <div className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-sm text-gray-500">
                                            Gerando QR Code...
                                        </div>
                                    )}
                                    <button
                                        onClick={handleDownloadQR}
                                        className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                                    >
                                        <FontAwesomeIcon icon={icons.faDownload} /> Baixar QR Code
                                    </button>
                                </div>
                            </section>

                            {/* TEMPO DE PREPARO */}
                            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-900">Tempo Médio de Preparo</h2>
                                <p className="text-sm text-gray-700">
                                    Defina se deseja utilizar o cálculo automático (necessário ter pelo menos uma semana de uso) ou inserir um intervalo manualmente.
                                </p>

                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="prep_mode"
                                                value="auto"
                                                checked={prepMode === "auto"}
                                                onChange={() => setPrepMode("auto")}
                                            />
                                            <span className="text-sm">Automático</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="prep_mode"
                                                value="manual"
                                                checked={prepMode === "manual"}
                                                onChange={() => setPrepMode("manual")}
                                            />
                                            <span className="text-sm">Manual</span>
                                        </label>
                                    </div>

                                    <div className="ml-auto flex gap-2">
                                        <button
                                            onClick={handleComputeNow}
                                            disabled={computing || prepMode !== "auto"}
                                            className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {computing ? "Calculando..." : "Calcular agora"}
                                        </button>
                                        <button
                                            onClick={handleSaveGeneral}
                                            disabled={computing || updatingManual}
                                            className="rounded-md bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>

                                {prepMode === "manual" && (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
                                        <div>
                                            <label className="block text-xs text-gray-600">Mínimo (minutos)</label>
                                            <input
                                                type="number"
                                                value={manualMin as any}
                                                onChange={(e) => setManualMin(e.target.value === "" ? "" : Number(e.target.value))}
                                                className="w-full rounded-md border-gray-300 px-2 py-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600">Máximo (minutos)</label>
                                            <input
                                                type="number"
                                                value={manualMax as any}
                                                onChange={(e) => setManualMax(e.target.value === "" ? "" : Number(e.target.value))}
                                                className="w-full rounded-md border-gray-300 px-2 py-1"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Clique em "Salvar" à direita para persistir manualmente.</div>
                                        </div>
                                        <p className="text-xs text-gray-500 sm:col-span-3">A diferença entre máximo e mínimo deve ser ao menos 20 minutos.</p>
                                        {restaurant.prep_time_computed_at && (
                                            <p className="text-xs text-gray-500 sm:col-span-3">
                                                Última atualização: {new Date(restaurant.prep_time_computed_at).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {restaurant.prep_time_min_minutes !== null && restaurant.prep_time_max_minutes !== null && (
                                    <div className="mt-2 text-sm text-gray-700">
                                        Estimativa atual:{" "}
                                        <span className="font-semibold">
                                            {restaurant.prep_time_min_minutes}–{restaurant.prep_time_max_minutes} minutos
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500">
                                            ({restaurant.prep_time_source === "manual" ? "definido manualmente" : "estimado automaticamente"})
                                        </span>
                                    </div>
                                )}

                            </section>

                            {/* CARDÁPIO DO RESTAURANTE */}
                            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-900">Cardápio do Restaurante</h2>
                                <p className="text-sm text-gray-700">Crie e gerencie o cardápio principal do seu restaurante.</p>

                                {menu ? (
                                    <div
                                        onClick={() => goToMenu(menu.id)}
                                        className="group relative flex items-start justify-between gap-4 rounded-md border p-4 hover:shadow cursor-pointer"
                                    >
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900">{menu.name}</h3>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <button
                                                onClick={toggleMenuActive}
                                                className={`px-3 py-1 rounded text-sm font-medium ${menu.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}
                                                title="Alternar disponibilidade do cardápio"
                                            >
                                                {menu.is_active ? "Disponível" : "Indisponível"}
                                            </button>

                                            <button
                                                onClick={handleDeleteMenu}
                                                className="px-3 py-1 rounded bg-red-600 text-white text-sm"
                                                title="Excluir cardápio"
                                            >
                                                <FontAwesomeIcon icon={icons.faTrash} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleCreateMenu}
                                        className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                                    >
                                        <FontAwesomeIcon icon={icons.faPlus} /> Criar Cardápio
                                    </button>
                                )}
                            </section>

                            {/* ZONA DE PERIGO - DELETAR RESTAURANTE */}
                            <section className="space-y-4 rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-red-800">Zona de Perigo: Restaurante</h2>
                                <p className="text-sm text-red-700">
                                    Exclui seu restaurante <b>"{restaurant.name}"</b> e todos os seus dados relacionados (cardápios, pedidos, etc.) permanentemente. Sua conta de usuário permanecerá ativa.
                                </p>

                                <button
                                    onClick={handleDeleteRestaurant}
                                    disabled={isDeletingRestaurant || isDeletingAccount}
                                    className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                                >
                                    <FontAwesomeIcon icon={icons.faTrash} /> {isDeletingRestaurant ? "Deletando Restaurante..." : "Deletar Restaurante"}
                                </button>
                            </section>
                        </>
                    )}

                    {/* ZONA DE PERIGO - DELETAR CONTA (Renderizada sempre) */}
                    <section className="space-y-4 rounded-lg border border-red-500 bg-red-100 p-6 shadow-md">
                        <h2 className="text-lg font-semibold text-red-900">Zona de Perigo: Deletar Conta</h2>
                        <p className="text-sm text-red-800 font-medium">
                            Esta ação é irreversível e deletará:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-800 ml-4">
                            <li>Sua conta de usuário ({user?.email}) do Supabase Auth.</li>
                            {restaurant && <li>O restaurante "{restaurant.name}" e **TODOS** os dados associados (cardápios, itens, pedidos, logos, etc.).</li>}
                            {!restaurant && <li>Todos os dados de usuário associados.</li>}
                        </ul>
                        <p className="text-xs text-red-700 mt-2">
                            Você será desconectado e redirecionado para a página inicial.
                        </p>

                        <button
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount || isDeletingRestaurant}
                            className="rounded-md bg-red-800 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-900 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={icons.faTrash} /> {isDeletingAccount ? "Deletando Conta..." : "Deletar Conta Permanentemente"}
                        </button>
                    </section>

                </div>
            </div>
        </>
    );
}

// Para o TypeScript reconhecer 'window.QRCode'
declare global {
    interface Window {
        QRCode: {
            toDataURL: (text: string, options: { width: number; margin: number }, callback: (err: any, dataUrl: string) => void) => void;
        };
    }
}
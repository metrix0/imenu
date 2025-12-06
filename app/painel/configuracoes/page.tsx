// app/painel/configuracoes/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import { uploadLogoImage } from "@/lib/uploadLogoImage";
import type { User } from "@supabase/supabase-js";

// FontAwesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faTrash, faCopy, faDownload, faCheck, faPen, faCalculator } from "@fortawesome/free-solid-svg-icons";

// UI Components
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ToggleInput from "@/components/ui/ToggleInput";
import Loader from "@/components/ui/Loader";
import Popup from "@/components/ui/Popup";
import Toast from "@/components/ui/Toast";

// Tipos
type Restaurant = {
    id: string;
    name: string;
    url_slug?: string | null;
    logo_url?: string | null;
    user_id?: string | null;
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

// Helper para carregar scripts externos (QR Code)
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
    // CORREÇÃO 1: Importamos 'clear' para limpar o estado corretamente
    const { restaurantId, setRestaurantId, clear } = useCreationStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Estados de Dados ---
    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Estados de UI (Popup e Toast) ---
    const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
        show: false, message: "", type: "info",
    });

    const [confirmPopup, setConfirmPopup] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText: string;
        isDestructive?: boolean;
    }>({
        show: false, title: "", message: "", onConfirm: () => { }, confirmText: "Confirmar", isDestructive: false,
    });

    // --- Estados Específicos de Ações ---
    const [isDeletingAction, setIsDeletingAction] = useState(false);
    const [userName, setUserName] = useState("");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const [shareableUrl, setShareableUrl] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");

    // Prep Time
    const [prepMode, setPrepMode] = useState<"auto" | "manual">("auto");
    const [manualMin, setManualMin] = useState<string>("");
    const [manualMax, setManualMax] = useState<string>("");
    const [computingPrep, setComputingPrep] = useState(false);
    const [savingPrep, setSavingPrep] = useState(false);

    // --- Helpers de Feedback ---
    const showToast = (message: string, type: "success" | "error" | "info") => {
        setToast({ show: true, message, type });
    };

    const closeToast = () => setToast((prev) => ({ ...prev, show: false }));

    const openConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "Confirmar", isDestructive = false) => {
        setConfirmPopup({ show: true, title, message, onConfirm, confirmText, isDestructive });
    };

    // --- Data Fetching ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.push("/restaurante");
                    return;
                }
                const currentUser = session.user;
                setUser(currentUser);
                setUserName((currentUser.user_metadata as any)?.full_name || currentUser.email || "");

                // Lógica unificada de ID
                let targetId = restaurantId;
                if (!targetId) {
                    const { data: rest } = await supabase.from("restaurants").select("id").eq("user_id", currentUser.id).single();
                    if (rest) {
                        targetId = rest.id;
                        setRestaurantId(rest.id);
                    }
                }

                if (targetId) {
                    // Carregar Detalhes do Restaurante
                    const { data: restData } = await supabase
                        .from("restaurants")
                        .select("id, name, url_slug, logo_url, user_id, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at")
                        .eq("id", targetId)
                        .single();

                    if (restData) {
                        setRestaurant(restData);
                        
                        // Configura modo de preparo
                        const isManual = restData.prep_time_source === "manual" || (typeof restData.prep_time_min_minutes === "number" && typeof restData.prep_time_max_minutes === "number" && !restData.prep_time_source);
                        setPrepMode(isManual ? "manual" : "auto");
                        setManualMin(restData.prep_time_min_minutes ? String(restData.prep_time_min_minutes) : "");
                        setManualMax(restData.prep_time_max_minutes ? String(restData.prep_time_max_minutes) : "");

                        // Carregar Menu
                        const { data: menuData } = await supabase
                            .from("menu")
                            .select("id, name, description, is_active, banner_url")
                            .eq("restaurant_id", targetId)
                            .maybeSingle();

                        if (menuData) setMenu(menuData);

                        // QR Code
                        if (restData.url_slug) {
                            const url = `${window.location.origin}/${restData.url_slug}`;
                            setShareableUrl(url);
                            loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js", () => {
                                if ((window as any).QRCode) {
                                    (window as any).QRCode.toDataURL(url, { width: 200, margin: 1 }, (err: any, dataUrl: string) => {
                                        if (!err) setQrCodeUrl(dataUrl);
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                showToast("Erro ao carregar dados.", "error");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [router, restaurantId, setRestaurantId]);

    // --- Handlers ---

const handleNameUpdate = async () => {
        if (!userName.trim()) return showToast("O nome não pode ser vazio.", "error");
        setIsUpdatingName(true);
        try {
            const { error } = await supabase.auth.updateUser({ data: { full_name: userName.trim() } });
            if (error) throw error;
            showToast("Nome atualizado!", "success");
        } catch (e: any) { showToast(e.message, "error"); } finally { setIsUpdatingName(false); }
    };

    const handleComputeNow = async () => {
        if (!restaurant) return;
        setComputingPrep(true);
        try {
            await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
            showToast("Cálculo realizado!", "success");
        } catch(e) { showToast("Erro ao calcular.", "error"); } finally { setComputingPrep(false); }
    };

    const handleSavePrepTime = async () => {
        if (!restaurant) return;
        setSavingPrep(true);
        try {
            const body = prepMode === "manual" ? { min: Number(manualMin), max: Number(manualMax), source: "manual" } : { source: "auto" };
            const res = await fetch(`/api/restaurants/${restaurant.id}/set-prep-time`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if(!res.ok) throw new Error();
            if(prepMode === "auto") await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
            showToast("Tempo salvo!", "success");
        } catch(e) { showToast("Erro ao salvar.", "error"); } finally { setSavingPrep(false); }
    };

    const toggleMenuStatus = async (val: boolean) => {
        if(!menu) return;
        try {
            await supabase.from("menu").update({ is_active: val }).eq("id", menu.id);
            setMenu({ ...menu, is_active: val });
            showToast(`Cardápio ${val ? "ativado" : "desativado"}.`, "success");
        } catch(e) { showToast("Erro ao atualizar.", "error"); }
    };

    const confirmDeleteMenu = () => {
        openConfirm("Excluir Cardápio", `Excluir "${menu?.name}"?`, async () => {
            if(!menu) return;
            setIsDeletingAction(true);
            try {
                await fetch("/api/menu/delete-menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuId: menu.id }) });
                setMenu(null);
                showToast("Cardápio excluído.", "success");
            } catch(e) { showToast("Erro ao excluir.", "error"); } finally { setIsDeletingAction(false); }
        }, "Excluir", true);
    };

    const confirmDeleteRestaurant = () => {
        openConfirm("Deletar Restaurante", `Deletar "${restaurant?.name}"?`, async () => {
            if(!restaurant) return;
            setIsDeletingAction(true);
            try {
                await fetch("/api/restaurants/delete-restaurant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, userId: restaurant.user_id }) });
                showToast("Restaurante deletado.", "success");
                clear();
                router.push("/restaurante/criar");
            } catch(e) { showToast("Erro ao deletar.", "error"); } finally { setIsDeletingAction(false); }
        }, "Deletar", true);
    };

    const confirmDeleteAccount = () => {
        openConfirm("Deletar Conta", "Ação irreversível.", async () => {
            if(!user) return;
            setIsDeletingAction(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if(restaurant) await fetch("/api/restaurants/delete-restaurant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, userId: user.id }) });
                await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: session?.access_token }) });
                await supabase.auth.signOut();
                clear();
                router.push("/restaurante");
                showToast("Conta deletada.", "success");
            } catch(e) { showToast("Erro ao deletar conta.", "error"); setIsDeletingAction(false); }
        }, "Deletar", true);
    };

    const handleCopyLink = () => {
        if (shareableUrl && navigator.clipboard) {
            navigator.clipboard.writeText(shareableUrl);
            showToast("Link copiado!", "success");
        }
    };

    // Gera URL visual do QR Code
    const qrCodeApiUrl = shareableUrl 
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareableUrl)}`
        : null;

    const handleDownloadQr = async () => {
        if (!qrCodeApiUrl) return;
        try {
            const response = await fetch(qrCodeApiUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `qrcode-${restaurant?.url_slug || "cardapio"}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            showToast("Erro ao baixar imagem.", "error");
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader /></div>;

    return (
        <>
            {/* Popup de Confirmação */}
            <Popup open={confirmPopup.show} onClose={() => setConfirmPopup((prev) => ({ ...prev, show: false }))}>
                <div className="p-6 text-center space-y-4">
                    <h3 className={`text-xl font-bold ${confirmPopup.isDestructive ? "text-red-600" : "text-gray-900"}`}>
                        {confirmPopup.title}
                    </h3>
                    <p className="text-gray-600">{confirmPopup.message}</p>
                    <div className="flex justify-center gap-4 mt-4">
                        <Button variant="secondary" onClick={() => setConfirmPopup((prev) => ({ ...prev, show: false }))}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                confirmPopup.onConfirm();
                                setConfirmPopup((prev) => ({ ...prev, show: false }));
                            }}
                            className={confirmPopup.isDestructive ? "!bg-red-600 hover:!bg-red-700 border-red-600" : ""}
                            loading={isDeletingAction}
                        >
                            {confirmPopup.confirmText}
                        </Button>
                    </div>
                </div>
            </Popup>

            {/* Toast de Notificação */}
            {toast.show && (
                <Toast message={toast.message} type={toast.type} onClose={closeToast} />
            )}

            <div className="min-h-screen bg-gray-50 px-2">
                <div className="max-w-6xl mx-auto space-y-8 pb-32">

                    {/* HEADER & LOGO */}
                    <div className="flex flex-col">

                        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
                        <p className="text-gray-600 mt-1">
                            {restaurant
                                ? <>Gerenciando: <span className="font-semibold text-brand">{restaurant.name}</span></>
                                : "Gerencie sua conta e crie seu restaurante."}
                        </p>
                    </div>

                    {/* --- MINHA CONTA --- */}
                    <Card>
                        <h2 className="text-xl font-medium text-gray-900 mb-4">Minha Conta</h2>

                        <div className="space-y-6">
                            <div className="flex gap-3 items-end">
                                <div className="flex-grow">
                                    <Input
                                        label="Nome Completo"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                                <div className="">
                                    <Button
                                        className="py-4"
                                        variant="primary"
                                        onClick={handleNameUpdate}
                                        loading={isUpdatingName}
                                        disabled={!userName.trim() || userName === user?.user_metadata?.full_name}
                                    >
                                        <FontAwesomeIcon icon={faCheck} />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">E-mail</p>
                                        <p className="text-gray-900 font-medium">{user?.email}</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => router.push("/painel/configuracoes/atualizando-email")}>
                                        Alterar
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">Senha</p>
                                        <p className="text-gray-900 font-medium">••••••••</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => router.push("/painel/configuracoes/nova-senha")}>
                                        Alterar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* --- LÓGICA DO RESTAURANTE --- */}
                    {!restaurant ? (
                        <div className="p-8 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center space-y-4">
                            <h2 className="text-xl font-medium text-gray-700">Você ainda não possui um restaurante</h2>
                            <p className="text-gray-500">Crie seu primeiro restaurante para começar a vender.</p>
                            <Button variant="primary" onClick={() => router.push("/restaurante/criar")}>
                                Criar Restaurante Agora
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* --- COMPARTILHAR --- */}
                            <Card>
                                <h2 className="text-xl font-medium text-gray-900 mb-2">Compartilhar Cardápio</h2>
                                <p className="text-gray-500 text-sm mb-6">Divulgue seu link ou use o QR Code.</p>

                                <div className="space-y-6">
                                    <div className="flex gap-3">
                                        <div className="flex-grow">
                                            <Input value={shareableUrl} readOnly />
                                        </div>
                                        <Button variant="secondary" onClick={handleCopyLink}>
                                            <FontAwesomeIcon icon={faCopy} className="mr-2" /> Copiar
                                        </Button>
                                    </div>

                                    <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                                        {qrCodeUrl ? (
                                            <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-md border border-gray-200 mb-4" />
                                        ) : (
                                            <div className="w-48 h-48 flex items-center justify-center bg-gray-200 rounded-md mb-4 text-gray-500 text-sm">
                                                Carregando QR...
                                            </div>
                                        )}
                                        <Button variant="secondary" onClick={() => {
                                            if (!qrCodeUrl) return;
                                            const link = document.createElement("a");
                                            link.href = qrCodeUrl;
                                            link.download = `qrcode-${restaurant.url_slug}.png`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }}>
                                            <FontAwesomeIcon icon={faDownload} className="mr-2" /> Baixar Imagem
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {/* --- TEMPO DE PREPARO --- */}
                            <Card>
                                <h2 className="text-xl font-medium text-gray-900 mb-2">Tempo Médio de Preparo</h2>
                                <p className="text-gray-500 text-sm mb-6">Escolha como o tempo de entrega estimado é calculado. (Para cálculo automático é necessário pelo menos uma semana de uso)</p>

                                <div className="space-y-6">
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="prep_mode"
                                                value="auto"
                                                checked={prepMode === "auto"}
                                                onChange={() => setPrepMode("auto")}
                                                className="w-5 h-5 text-brand border-gray-300 focus:ring-brand"
                                            />
                                            <span className={`text-base ${prepMode === "auto" ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                                                Automático
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="prep_mode"
                                                value="manual"
                                                checked={prepMode === "manual"}
                                                onChange={() => setPrepMode("manual")}
                                                className="w-5 h-5 text-brand border-gray-300 focus:ring-brand"
                                            />
                                            <span className={`text-base ${prepMode === "manual" ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                                                Manual
                                            </span>
                                        </label>
                                    </div>

                                    {prepMode === "manual" && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Mínimo (min)"
                                                value={manualMin}
                                                onChange={(e) => setManualMin(e.target.value)}
                                                placeholder="Ex: 30"
                                                numeric
                                            />
                                            <Input
                                                label="Máximo (min)"
                                                value={manualMax}
                                                onChange={(e) => setManualMax(e.target.value)}
                                                placeholder="Ex: 50"
                                                numeric
                                            />
                                            <p className="col-span-2 text-xs text-gray-500">
                                                A diferença entre o mínimo e o máximo deve ser de pelo menos 20 minutos.
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3">
                                        {/* Botão Calcular Agora - Visível apenas se Auto estiver selecionado */}
                                        <Button
                                            variant="secondary"
                                            onClick={handleComputeNow}
                                            loading={computingPrep}
                                            disabled={prepMode !== "auto" || savingPrep}
                                            className={prepMode !== "auto" ? "opacity-50 cursor-not-allowed" : ""}
                                        >
                                            <FontAwesomeIcon icon={faCalculator} className="mr-2" /> Calcular Agora
                                        </Button>

                                        {/* Botão Salvar */}
                                        <Button
                                            variant="primary"
                                            onClick={handleSavePrepTime}
                                            loading={savingPrep}
                                            disabled={computingPrep}
                                        >
                                            Salvar Configurações
                                        </Button>
                                    </div>

                                    <div className="mt-4 p-3 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm flex justify-between items-center">
                                        <span>Estimativa atual visível aos clientes:</span>
                                        <span className="font-bold text-lg text-brand">
                                            {restaurant.prep_time_min_minutes || "?"}–{restaurant.prep_time_max_minutes || "?"} min
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            {/* --- CARDÁPIO --- */}
                            <Card>
                                {/* Container Flex Responsivo */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                    {/* Bloco de Texto (Título e descrição) */}
                                    <div>
                                        <h2 className="text-xl font-medium text-gray-900 mb-2">Cardápio Principal</h2>
                                        <p className="text-gray-500 text-sm mb-2">Gerencie o cardápio ativo do restaurante.</p>
                                    </div>

                                    {/* Botão (Só aparece se não tiver menu) */}
                                    {!menu && (
                                        <div className="flex justify-start md:justify-end w-full md:w-auto">
                                            <Button
                                                variant="primary"
                                                onClick={() => router.push(`/painel/cardapio`)}
                                                className="w-full md:w-auto" // Opcional: Deixa o botão largura total no mobile
                                            >
                                                Criar Cardápio
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {menu && (
                                    <div
                                        className="group border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex items-center justify-between cursor-pointer"
                                        onClick={() => router.push(`/painel/cardapio`)}
                                    >
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{menu.name}</h3>
                                        </div>

                                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600">Visível:</span>
                                                <ToggleInput
                                                    label=""
                                                    checked={menu.is_active || false}
                                                    onChange={(e) => toggleMenuStatus(e.target.checked)}
                                                />
                                            </div>
                                            <div className="w-px h-8 bg-gray-200 mx-2"></div>
                                            <button
                                                onClick={confirmDeleteMenu}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-2"
                                                title="Excluir cardápio"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Card>

                            {/* --- ZONA DE PERIGO: RESTAURANTE --- */}
                            <Card className="border-red-200">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Coluna 1: Textos */}
                                    <div>
                                        <h2 className="text-xl font-medium text-red-700 mb-2">Deletar Restaurante</h2>
                                        <p className="text-red-600/70 text-sm">
                                            Isso excluirá permanentemente o restaurante <b>{restaurant.name}</b> e todos os pedidos.
                                        </p>
                                    </div>

                                    {/* Coluna 2: Botão */}
                                    <div className="flex justify-center md:justify-end w-full md:w-auto">
                                        <Button
                                            variant="primary"
                                            className="!bg-red-600 hover:!bg-red-700 border-red-600 w-full md:w-auto"
                                            onClick={confirmDeleteRestaurant}
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-xs mr-2" /> Deletar Restaurante
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </>
                    )}

                    {/* --- ZONA DE PERIGO: CONTA --- */}
                    <Card className="border-red-200 bg-red-50/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Coluna 1: Textos */}
                            <div>
                                <h2 className="text-xl font-medium text-red-700 mb-2">Deletar Conta</h2>
                                <p className="text-red-600/70 text-sm">
                                    Ação irreversível. Todos os seus dados serão apagados.
                                </p>
                            </div>

                            {/* Coluna 2: Botão */}
                            <div className="flex justify-center md:justify-end w-full md:w-auto">
                                <Button
                                    variant="primary"
                                    className="!bg-red-600 hover:!bg-red-900 border-red-800 w-full md:w-auto"
                                    onClick={confirmDeleteAccount}
                                >
                                    <FontAwesomeIcon icon={faTrash} className="text-xs mr-2" /> Deletar Conta
                                </Button>
                            </div>
                        </div>
                    </Card>

                </div>
            </div>
        </>
    );
}

// Helper para tipagem do QRCode no window
declare global {
    interface Window {
        QRCode: {
            toDataURL: (text: string, options: { width: number; margin: number }, callback: (err: any, dataUrl: string) => void) => void;
        };
    }
}
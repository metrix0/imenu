// app/restaurante/[restauranteId]/configuracoes/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { uploadLogoImage } from "../../../../lib/uploadLogoImage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../../../lib/fontawesome";
import type { User } from "@supabase/supabase-js";

type Restaurant = {
    id: string;
    name: string;
    url_slug: string;
    logo_url?: string | null;
    user_id: string;
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

export default function RestauranteConfiguracoesPage() {
    const router = useRouter();
    const params = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Corrigido: o nome do parâmetro vem da pasta [restauranteId]
    const restaurantId = Array.isArray(params.restauranteId) ? params.restauranteId[0] : params.restauranteId;

    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [menu, setMenu] = useState<Menu | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: "error" | "success"; content: string } | null>(null);

    const [shareableUrl, setShareableUrl] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [copySuccess, setCopySuccess] = useState("");
    const [hoveringLogo, setHoveringLogo] = useState(false);

    // 🔐 Carrega dados do restaurante com verificação de permissão
    useEffect(() => {
        if (!restaurantId) return;

        const loadData = async () => {
            setLoading(true);
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                router.push("/admin/login");
                return;
            }

            setUser(session.user);

            const { data, error } = await supabase
                .from("restaurants")
                .select("id, name, url_slug, logo_url, user_id")
                .eq("id", restaurantId)
                .single();

            if (error || !data) {
                setMessage({ type: "error", content: "Restaurante não encontrado." });
                setLoading(false);
                return;
            }

            // 🚫 Bloqueia usuários não autorizados
            if (data.user_id !== session.user.id) {
                setMessage({
                    type: "error",
                    content: "Você não tem permissão para acessar este restaurante.",
                });
                setLoading(false);
                return;
            }

            setRestaurant(data);

            // buscar cardápio (selecionando campos extras para o card)
            const { data: menuData, error: menuError } = await supabase
                .from("menu")
                .select("id, name, description, is_active, banner_url")
                .eq("restaurant_id", data.id)
                .maybeSingle();

            if (!menuError && menuData) setMenu(menuData);

            const url = `${window.location.origin}/cardapio/${data.url_slug}`;
            setShareableUrl(url);

            loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js", () => {
                if (window.QRCode) {
                    window.QRCode.toDataURL(url, { width: 200, margin: 1 }, (err: any, dataUrl: string) => {
                        if (!err) setQrCodeUrl(dataUrl);
                    });
                }
            });

            setLoading(false);
        };

        loadData();
    }, [restaurantId, router]);

    // 🗑️ Excluir restaurante (chama API server-side que remove storage + dados relacionados)
    const handleDeleteRestaurant = async () => {
        if (!restaurant) return;
        if (!confirm(`Tem certeza que deseja deletar o restaurante "${restaurant.name}" e TODOS os dados relacionados? Essa ação é irreversível.`))
            return;

        setIsDeleting(true);
        try {
            const res = await fetch("/api/restaurants/delete-restaurant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId: restaurant.id }),
            });
            const json = await res.json();
            if (!res.ok || json?.error) {
                console.error("Erro ao deletar restaurante:", json);
                setMessage({ type: "error", content: `Erro ao deletar restaurante: ${json?.error ?? json?.detail ?? "ver console"}` });
                setIsDeleting(false);
                return;
            }
            setMessage({ type: "success", content: "Restaurante e dados relacionados deletados com sucesso." });
            router.push("/restaurante/criar");
        } catch (err) {
            console.error("Erro ao deletar restaurante:", err);
            setMessage({ type: "error", content: `Erro ao deletar: ${String(err)}` });
            setIsDeleting(false);
        }
    };

    // 📋 Copiar link
    const handleCopyLink = () => {
        if (!shareableUrl) return;
        navigator.clipboard.writeText(shareableUrl);
        setCopySuccess("Link copiado!");
        setTimeout(() => setCopySuccess(""), 2000);
    };

    // 📥 Baixar QR Code
    const handleDownloadQR = () => {
        if (!qrCodeUrl || !restaurant) return;
        const link = document.createElement("a");
        link.href = qrCodeUrl;
        link.download = `${restaurant.url_slug}-qrcode.png`;
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
        if (!confirm("Deseja remover a logo atual?")) return;

        try {
            // primeiro remove do bucket
            const key = restaurant.logo_url;
            const { error: storageErr } = await supabase.storage.from("restaurant-logos").remove([key]);
            if (storageErr) {
                // log e notifica
                console.error("Erro ao remover logo do storage:", storageErr);
                setMessage({ type: "error", content: `Erro ao remover arquivo do storage: ${storageErr.message}` });
                return;
            }

            // depois atualiza o registro no banco para null
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
        router.push(`/restaurante/${restaurant.id}/add-menu`);
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
        if (!confirm(`Excluir o cardápio "${menu.name}" e todos os itens relacionados? Esta ação é irreversível.`)) return;

        try {
            const res = await fetch("/api/menu/delete-menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ menuId: menu.id }),
            });
            const json = await res.json();
            if (!res.ok || json?.error) {
                console.error("Erro ao deletar menu:", json);
                setMessage({ type: "error", content: "Erro ao deletar cardápio. Veja console." });
                return;
            }
            setMenu(null);
            setMessage({ type: "success", content: "Cardápio excluído com sucesso." });
        } catch (err) {
            console.error("Erro ao deletar menu:", err);
            setMessage({ type: "error", content: `Erro ao deletar: ${String(err)}` });
        }
    };

    // navegar para editar / visualizar cardápio
    const goToMenu = (menuId: string) => {
        router.push(`/menu/${menuId}`);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <p className="text-gray-600 text-lg">Carregando configurações...</p>
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <p className="text-red-600 text-lg">{message?.content || "Restaurante não encontrado."}</p>
                <button
                    onClick={() => router.push("/restaurante/criar")}
                    className="mt-3 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                    Criar novo restaurante
                </button>
            </div>
        );
    }

    // obter URL pública da logo (se houver)
    const logoPublicUrl =
        restaurant.logo_url &&
        supabase.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url).data?.publicUrl;

    return (
        <div className="flex min-h-screen flex-col items-center bg-gray-50 p-6">
            <div className="w-full max-w-2xl space-y-8">
                {/* LOGO E CABEÇALHO */}
                <div className="flex flex-col items-center">
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

                    <h1 className="mt-3 text-3xl font-bold text-gray-900">Configurações</h1>
                    <p className="text-lg text-gray-600">
                        Gerenciando: <span className="font-semibold">{restaurant.name}</span>
                    </p>
                </div>

                {message && (
                    <div
                        className={`rounded-md p-3 text-sm font-medium ${message.type === "success"
                                ? "bg-green-100 text-green-800 border border-green-300"
                                : "bg-red-100 text-red-800 border border-red-300"
                            }`}
                    >
                        {message.content}
                    </div>
                )}

                {/* PERFIL */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Perfil da Loja</h2>
                    <p className="text-sm text-gray-700">Edite o nome, descrição e endereço do seu restaurante.</p>
                    <button
                        disabled
                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={icons.faEdit} /> Editar Perfil (Em breve)
                    </button>
                </section>

                {/* HORÁRIOS */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Horários</h2>
                    <p className="text-sm text-gray-700">Defina quando sua loja está aberta para receber pedidos.</p>
                    <button
                        disabled
                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={icons.faTimes} /> Definir Horários (Em breve)
                    </button>
                </section>

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
                            <FontAwesomeIcon icon={icons.faCheck} /> Baixar QR Code
                        </button>
                    </div>
                </section>

                {/* CARDÁPIO (novo card UI) */}
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
                                {menu.description ? (
                                    <p className="text-sm text-gray-600 mt-1">{menu.description}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 mt-1 italic">Sem descrição</p>
                                )}
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

                {/* ZONA DE PERIGO */}
                <section className="space-y-4 rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-red-800">Zona de Perigo</h2>
                    <p className="text-sm text-red-700">
                        Exclui seu restaurante e todos os seus dados permanentemente. Isso inclui cardápios, pedidos e configurações.
                    </p>

                    <button
                        onClick={handleDeleteRestaurant}
                        disabled={isDeleting}
                        className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={icons.faTrash} /> {isDeleting ? "Deletando..." : "Deletar Restaurante"}
                    </button>
                </section>
            </div>
        </div>
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

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

    // Average Delivery Time Estimation (prep time)
    const [prepMode, setPrepMode] = useState<"auto" | "manual">("auto");
    const [manualMin, setManualMin] = useState<number | "">("");
    const [manualMax, setManualMax] = useState<number | "">("");
    const [computing, setComputing] = useState(false);
    const [updatingManual, setUpdatingManual] = useState(false);

    // 🔐 Carrega dados do restaurante com verificação de permissão
    useEffect(() => {
        if (!restaurantId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session) {
                    router.push("/admin/login");
                    return;
                }
                setUser(session.user);

                // busca restaurante + campos de prep_time usando função reutilizável
                await fetchRestaurant();

                // buscar cardápio (selecionando campos extras para o card)
                const { data: menuData, error: menuError } = await supabase
                    .from("menu")
                    .select("id, name, description, is_active, banner_url")
                    .eq("restaurant_id", restaurantId)
                    .maybeSingle();

                if (!menuError && menuData) setMenu(menuData);

                // Preferir link por menuId (quando o restaurante tem um menu criado)
                const menuIdFromData = menuData?.id ?? null;
                const url = menuIdFromData
                    ? `${window.location.origin}/cardapio/${menuIdFromData}`
                    : `${window.location.origin}/cardapio/${(await getRestaurantSlug(restaurantId)) ?? ""}`;
                setShareableUrl(url);

                loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js", () => {
                    if ((window as any).QRCode) {
                        (window as any).QRCode.toDataURL(url, { width: 200, margin: 1 }, (err: any, dataUrl: string) => {
                            if (!err) setQrCodeUrl(dataUrl);
                        });
                    }
                });
            } catch (err) {
                console.error("Erro loadData configurações:", err);
                setMessage({ type: "error", content: "Erro ao carregar dados." });
            } finally {
                setLoading(false);
            }
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
        router.push(`/painel/${restaurant.id}/criar-cardapio`);
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
        // abre a view administrativa do cardápio dentro do painel
        router.push(`/painel/${restaurantId}/cardapio/${menuId}`);
    };

    // função auxiliar para obter slug (mantida separada para clareza)
    const getRestaurantSlug = async (id: string) => {
        const { data } = await supabase.from("restaurants").select("url_slug").eq("id", id).maybeSingle();
        return data?.url_slug ?? null;
    };

    // FETCH centralizado do restaurante (para garantir estado sincronizado com DB)
    const fetchRestaurant = async () => {
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

    // ---------- Prep time API interactions ----------
    const handleComputeNow = async () => {
        if (!restaurant) return;
        setComputing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw json;

            // re-fetch restaurant para obter valores atualizados
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
            // valida campos manual
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
                const json = await res.json();
                if (!res.ok) throw json;

                // re-fetch para garantir UI sincronizada com DB (mantém manual selecionado)
                await fetchRestaurant();

                setMessage({ type: "success", content: "Tempo de preparo salvo manualmente." });
            } catch (err: any) {
                console.error("Erro set-prep-time (manual):", err);
                setMessage({ type: "error", content: "Erro ao salvar tempo manual." });
            } finally {
                setUpdatingManual(false);
            }
        } else {
            // modo automatico: remove valores manuais e marca source=auto
            setComputing(true);
            try {
                // 1) seta source = auto (limpa manual) no backend
                const res1 = await fetch(`/api/restaurants/${restaurant.id}/set-prep-time`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "auto" }),
                });
                const json1 = await res1.json();
                if (!res1.ok) throw json1;

                // re-fetch para garantir UI sincronizada com DB (modo auto)
                await fetchRestaurant();

                // 2) solicitar cálculo automático imediato
                const res2 = await fetch(`/api/restaurants/${restaurant.id}/compute-prep-time`, { method: "POST" });
                if (res2.ok) {
                    // atualiza novamente com valores automáticos
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
 
                 {/* TEMPO MÉDIO DE PREPARO */}
                 <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                     <h2 className="text-lg font-semibold text-gray-900">Tempo médio de preparo</h2>
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
                                 disabled={computing}
                                 className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700"
                             >
                                 {computing ? "Calculando..." : "Calcular agora"}
                             </button>
                             <button
                                 onClick={handleSaveGeneral}
                                 disabled={computing || updatingManual}
                                 className="rounded-md bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700"
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
                                 {/* Obs: botao de salvar manual agora é o salvar geral */}
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

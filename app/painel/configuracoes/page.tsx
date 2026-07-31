"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCopy,
    faDownload,
    faSignOutAlt,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

type Restaurant = {
    id: string;
    name: string;
    url_slug?: string | null;
    user_id?: string | null;
    phone?: string | null;
};

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function ConfiguracoesPage() {
    const router = useRouter();
    const { restaurantId, setRestaurantId, clear } = useCreationStore();
    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingField, setSavingField] = useState<"name" | "phone" | null>(null);
    const [userName, setUserName] = useState("");
    const [savedUserName, setSavedUserName] = useState("");
    const [phone, setPhone] = useState("");
    const [savedPhone, setSavedPhone] = useState("");
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [shareableUrl, setShareableUrl] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.user) {
                    router.replace("/restaurante/login");
                    return;
                }

                setUser(session.user);
                const initialName =
                    String(session.user.user_metadata?.full_name || "");
                setUserName(initialName);
                setSavedUserName(initialName);

                let targetId = restaurantId;
                if (!targetId) {
                    const { data: rest } = await supabase
                        .from("restaurants")
                        .select("id")
                        .eq("user_id", session.user.id)
                        .maybeSingle();
                    if (rest) {
                        targetId = rest.id;
                        setRestaurantId(rest.id);
                    }
                }

                if (targetId) {
                    const { data: restData } = await supabase
                        .from("restaurants")
                        .select("id, name, url_slug, user_id, phone")
                        .eq("id", targetId)
                        .single();

                    if (restData) {
                        setRestaurant(restData);
                        const formattedPhone = formatPhone(restData.phone || "");
                        setPhone(formattedPhone);
                        setSavedPhone(formattedPhone);
                        if (restData.url_slug) {
                            setShareableUrl(
                                `${window.location.origin}/${restData.url_slug}`
                            );
                        }
                    }
                }
            } catch (error) {
                console.error(error);
                setToast({ message: "Erro ao carregar dados.", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [restaurantId, router, setRestaurantId]);

    const saveName = async () => {
        const normalized = userName.trim();
        if (!user || !normalized || normalized === savedUserName) return;

        setSavingField("name");
        const { error } = await supabase.auth.updateUser({
            data: { full_name: normalized },
        });
        setSavingField(null);

        if (error) {
            setToast({ message: error.message, type: "error" });
            return;
        }

        setSavedUserName(normalized);
        setToast({ message: "Nome atualizado!", type: "success" });
    };

    const savePhone = async () => {
        if (!restaurant || phone === savedPhone) return;
        if (phone.replace(/\D/g, "").length !== 11) {
            setToast({ message: "Digite um celular válido.", type: "error" });
            return;
        }

        setSavingField("phone");
        const response = await fetch(`/api/restaurants/${restaurant.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
        });
        setSavingField(null);

        if (!response.ok) {
            setToast({ message: "Erro ao salvar celular.", type: "error" });
            return;
        }

        setSavedPhone(phone);
        setToast({ message: "Celular atualizado!", type: "success" });
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        clear();
        router.push("/restaurante/login");
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsDeleting(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (restaurant) {
                await fetch("/api/restaurants/delete-restaurant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        restaurantId: restaurant.id,
                        userId: user.id,
                    }),
                });
            }

            const response = await fetch("/api/auth/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: session?.access_token }),
            });

            if (!response.ok) throw new Error("Erro ao deletar conta.");
            await supabase.auth.signOut();
            clear();
            router.push("/restaurante");
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Erro ao deletar conta.",
                type: "error",
            });
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    };

    const copyLink = async () => {
        if (!shareableUrl) return;
        await navigator.clipboard.writeText(shareableUrl);
        setToast({ message: "Link copiado!", type: "success" });
    };

    const downloadQr = async () => {
        if (!shareableUrl) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareableUrl)}`;
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `qrcode-${restaurant?.url_slug || "cardapio"}.png`;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            setToast({ message: "Erro ao baixar QR Code.", type: "error" });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-10">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <>
            <ConfirmModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Deletar conta?"
                description="Ação irreversível. Todos os seus dados serão apagados."
                confirmLabel="Deletar conta"
                isLoading={isDeleting}
                variant="danger"
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="min-h-screen bg-gray-50 px-4 pb-20 pt-8 sm:px-6">
                <div className="mx-auto max-w-6xl space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                            Configurações
                        </h1>
                        <p className="mt-1 text-gray-600 2xl:text-lg">
                            Gerencie sua conta e seu acesso.
                        </p>
                    </div>

                    <Card className="border border-gray-200 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-medium text-gray-900">
                                Minha Conta
                            </h2>
                            <Button
                                variant="secondary"
                                onClick={handleLogout}
                                loading={isLoggingOut}
                                className="bg-white text-sm text-red-600 hover:bg-red-50"
                            >
                                <FontAwesomeIcon
                                    icon={faSignOutAlt}
                                    className="mr-2"
                                />
                                Sair da Conta
                            </Button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <Input
                                    label="Nome do Responsável"
                                    value={userName}
                                    onChange={(event) =>
                                        setUserName(event.target.value)
                                    }
                                    onBlur={saveName}
                                    placeholder="Nome do responsável"
                                />
                                {savingField === "name" && (
                                    <p className="mt-1 text-xs text-brand">
                                        Salvando...
                                    </p>
                                )}
                            </div>

                            <div>
                                <Input
                                    label="Celular do Responsável"
                                    value={phone}
                                    onChange={(event) =>
                                        setPhone(formatPhone(event.target.value))
                                    }
                                    onBlur={savePhone}
                                    placeholder="(00) 00000-0000"
                                    type="tel"
                                    maxLength={15}
                                />
                                {savingField === "phone" && (
                                    <p className="mt-1 text-xs text-brand">
                                        Salvando...
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-500">
                                            E-mail
                                        </p>
                                        <p className="break-all font-medium text-gray-900">
                                            {user?.email}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            router.push(
                                                "/painel/configuracoes/atualizando-email"
                                            )
                                        }
                                    >
                                        Alterar
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">
                                            Senha
                                        </p>
                                        <p className="font-medium text-gray-900">
                                            ••••••••
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            router.push(
                                                "/painel/configuracoes/nova-senha"
                                            )
                                        }
                                    >
                                        Alterar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {restaurant && shareableUrl && (
                        <Card className="border border-gray-200 shadow-sm">
                            <h2 className="mb-2 text-xl font-medium text-gray-900">
                                Compartilhar Cardápio
                            </h2>
                            <p className="mb-6 text-sm text-gray-500">
                                Divulgue seu link ou use o QR Code.
                            </p>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Input value={shareableUrl} readOnly />
                                <Button variant="secondary" onClick={copyLink}>
                                    <FontAwesomeIcon icon={faCopy} className="mr-2" />
                                    Copiar
                                </Button>
                            </div>

                            <div className="mt-6 flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 p-6">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareableUrl)}`}
                                    alt="QR Code do cardápio"
                                    className="mb-4 h-48 w-48 rounded-md border border-gray-200"
                                />
                                <Button variant="secondary" onClick={downloadQr}>
                                    <FontAwesomeIcon
                                        icon={faDownload}
                                        className="mr-2"
                                    />
                                    Baixar Imagem
                                </Button>
                            </div>
                        </Card>
                    )}

                    <Card className="border-red-200 bg-red-50/30">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h2 className="mb-2 text-lg font-medium text-red-700">
                                    Deletar Conta
                                </h2>
                                <p className="text-sm text-red-600/70">
                                    Ação irreversível. Todos os seus dados serão
                                    apagados.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                className="w-full bg-red-600 text-white hover:bg-red-700 md:w-auto"
                                onClick={() => setDeleteModalOpen(true)}
                            >
                                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                Deletar Conta
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import {
    faChair,
    faCopy,
    faDownload,
    faEdit,
    faImage,
    faPalette,
    faPlus,
    faQrcode,
    faTrash,
} from "@fortawesome/free-solid-svg-icons";

import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import QrDesignModal, {
    type QrDesignTemplate,
} from "@/components/restaurant-owner/mesas/QrDesignModal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    startQrTableCheckout,
    updateQrTableDesign,
} from "@/lib/qr-table/clientApi";
import { downloadQrDesign } from "@/lib/qr-table/downloadQrDesign";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

type Restaurant = {
    id: string;
    name: string | null;
    url_slug: string | null;
    custom_domain: string | null;
    banner_url: string | null;
    logo_url: string | null;
};

type RestaurantTable = {
    id: string;
    restaurant_id: string;
    name: string;
    public_token: string;
    position: number;
    is_active: boolean;
};

type ToastState = {
    message: string;
    type: "success" | "error" | "info";
};

const DEMO_TABLES = ["Mesa 1", "Mesa 2", "Mesa 3"];
const DEFAULT_QR_DESIGN_COLOR = "#F97316";

function qrImageUrl(value: string, size = 220): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
        value
    )}`;
}

export default function MesasPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [addon, setAddon] = useState<QrTableAddon | null>(null);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [salesOpen, setSalesOpen] = useState(false);
    const [buying, setBuying] = useState(false);
    const [designOpen, setDesignOpen] = useState(false);
    const [savingDesign, setSavingDesign] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingTable, setEditingTable] =
        useState<RestaurantTable | null>(null);
    const [tableName, setTableName] = useState("");
    const [savingTable, setSavingTable] = useState(false);
    const [tableToDelete, setTableToDelete] =
        useState<RestaurantTable | null>(null);
    const [deletingTable, setDeletingTable] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);

    const active = hasQrTableAccess(addon);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.user) return;

            let targetRestaurantId = restaurantId;
            if (!targetRestaurantId) {
                const { data: ownerRestaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .maybeSingle();
                targetRestaurantId = ownerRestaurant?.id || null;
                if (targetRestaurantId) setRestaurantId(targetRestaurantId);
            }

            if (!targetRestaurantId) return;

            const { data: restaurantData, error: restaurantError } =
                await supabase
                    .from("restaurants")
                    .select(
                        "id, name, url_slug, custom_domain, banner_url, logo_url"
                    )
                    .eq("id", targetRestaurantId)
                    .single();
            if (restaurantError) throw restaurantError;
            setRestaurant(restaurantData as Restaurant);

            const { data: addonData, error: addonError } = await supabase
                .from("restaurant_addons")
                .select("*")
                .eq("restaurant_id", targetRestaurantId)
                .eq("product_key", "qr_code_mesa")
                .maybeSingle();
            if (addonError) throw addonError;

            const normalizedAddon = (addonData as QrTableAddon | null) || null;
            setAddon(normalizedAddon);
            const isActive = hasQrTableAccess(normalizedAddon);

            if (isActive) {
                const { data: tableData, error: tableError } = await supabase
                    .from("restaurant_tables")
                    .select(
                        "id, restaurant_id, name, public_token, position, is_active"
                    )
                    .eq("restaurant_id", targetRestaurantId)
                    .eq("is_active", true)
                    .order("position", { ascending: true })
                    .order("created_at", { ascending: true });
                if (tableError) throw tableError;
                setTables((tableData as RestaurantTable[]) || []);
            } else {
                setTables([]);
            }

            void captureQrTableEvent("qr_code_mesa_page_viewed", {
                restaurant_id: targetRestaurantId,
                active: isActive,
            });
        } catch (error) {
            console.error("Erro ao carregar mesas:", error);
            setToast({
                message: "Não foi possível carregar as mesas.",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        void loadData();

        const checkoutState = new URLSearchParams(window.location.search).get(
            "checkout"
        );
        if (checkoutState === "success") {
            setToast({
                message:
                    "Pagamento enviado. A ativação ocorre após a confirmação do Asaas.",
                type: "success",
            });
        } else if (checkoutState === "cancel") {
            setToast({ message: "Pagamento cancelado.", type: "info" });
        } else if (checkoutState === "expired") {
            setToast({
                message: "O link de pagamento expirou. Tente novamente.",
                type: "info",
            });
        }
    }, [loadData]);

    const menuBaseUrl = useMemo(() => {
        if (!restaurant) return "";
        if (!restaurant.url_slug || typeof window === "undefined") return "";
        return `${window.location.origin}/mesa/${restaurant.url_slug}`;
    }, [restaurant]);

    const buildTableUrl = useCallback(
        (token: string) => `${menuBaseUrl}/${encodeURIComponent(token)}`,
        [menuBaseUrl]
    );

    const bannerUrl = useMemo(() => {
        if (!restaurant?.banner_url) return "/placeholders/banner.png";
        if (/^https?:\/\//i.test(restaurant.banner_url)) {
            return restaurant.banner_url;
        }
        return supabase.storage
            .from("menu-banners")
            .getPublicUrl(restaurant.banner_url).data.publicUrl;
    }, [restaurant]);

    const logoUrl = useMemo(() => {
        if (!restaurant?.logo_url) return "";
        if (/^https?:\/\//i.test(restaurant.logo_url)) {
            return restaurant.logo_url;
        }
        return supabase.storage
            .from("restaurant-logos")
            .getPublicUrl(restaurant.logo_url).data.publicUrl;
    }, [restaurant]);

    const qrDesignTemplate = addon?.qr_design_template || "banner";
    const qrDesignColor = addon?.qr_design_color || DEFAULT_QR_DESIGN_COLOR;

    const openSalesModal = () => {
        setSalesOpen(true);
        void captureQrTableEvent("qr_code_mesa_learn_more_viewed", {
            restaurant_id: restaurant?.id || null,
            source: "mesas",
        });
    };

    const buy = async () => {
        if (!restaurant) return;
        setBuying(true);
        void captureQrTableEvent("qr_code_mesa_purchase_started", {
            restaurant_id: restaurant.id,
            source: "mesas",
        });
        try {
            await startQrTableCheckout(restaurant.id, "mesas");
        } catch (error) {
            setBuying(false);
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível abrir o pagamento.",
                type: "error",
            });
        }
    };

    const saveDesign = async (
        template: QrDesignTemplate,
        color: string
    ) => {
        if (!restaurant || !addon) return;
        setSavingDesign(true);

        try {
            await updateQrTableDesign(restaurant.id, template, color);
            setAddon((current) =>
                current
                    ? {
                          ...current,
                          qr_design_template: template,
                          qr_design_color: color.toUpperCase(),
                      }
                    : current
            );
            setDesignOpen(false);
            setToast({ message: "Design salvo!", type: "success" });
        } catch {
            setToast({
                message: "Não foi possível salvar o design.",
                type: "error",
            });
        } finally {
            setSavingDesign(false);
        }
    };

    const openNewTable = () => {
        setEditingTable(null);
        setTableName(`Mesa ${tables.length + 1}`);
        setEditorOpen(true);
    };

    const openEditTable = (table: RestaurantTable) => {
        setEditingTable(table);
        setTableName(table.name);
        setEditorOpen(true);
    };

    const saveTable = async () => {
        if (!restaurant || !tableName.trim()) return;
        setSavingTable(true);

        const operation = editingTable
            ? supabase
                  .from("restaurant_tables")
                  .update({ name: tableName.trim(), updated_at: new Date() })
                  .eq("id", editingTable.id)
                  .eq("restaurant_id", restaurant.id)
            : supabase.from("restaurant_tables").insert({
                  restaurant_id: restaurant.id,
                  name: tableName.trim(),
                  position: tables.length,
              });

        const { error } = await operation;
        setSavingTable(false);

        if (error) {
            setToast({
                message:
                    error.code === "23505"
                        ? "Já existe uma mesa com este nome."
                        : "Não foi possível salvar a mesa.",
                type: "error",
            });
            return;
        }

        setEditorOpen(false);
        setToast({
            message: editingTable ? "Mesa atualizada!" : "Mesa criada!",
            type: "success",
        });
        await loadData();
    };

    const deleteTable = async () => {
        if (!restaurant || !tableToDelete) return;
        setDeletingTable(true);
        const { error } = await supabase
            .from("restaurant_tables")
            .delete()
            .eq("id", tableToDelete.id)
            .eq("restaurant_id", restaurant.id);
        setDeletingTable(false);

        if (error) {
            setToast({
                message: "Não foi possível excluir a mesa.",
                type: "error",
            });
            return;
        }

        setTableToDelete(null);
        setToast({ message: "Mesa excluída!", type: "success" });
        await loadData();
    };

    const copyUrl = async (url: string) => {
        await navigator.clipboard.writeText(url);
        setToast({ message: "Link copiado!", type: "success" });
    };

    const downloadQr = async (url: string, fileName: string) => {
        try {
            const response = await fetch(qrImageUrl(url, 500));
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            setToast({
                message: "Não foi possível baixar o QR Code.",
                type: "error",
            });
        }
    };

    const downloadDesignedQr = async (
        qrValue: string,
        displayUrl: string,
        title: string,
        fileName: string
    ) => {
        try {
            await downloadQrDesign({
                qrValue,
                displayUrl,
                title,
                bannerUrl,
                logoUrl,
                fileName,
                template: qrDesignTemplate,
                accentColor: qrDesignColor,
            });
        } catch {
            setToast({
                message: "Não foi possível baixar o QR Code com design.",
                type: "error",
            });
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    const universalUrl =
        addon?.universal_token && menuBaseUrl
            ? menuBaseUrl
            : "";
    const universalDisplayUrl = universalUrl
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");

    return (
        <>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <QrCodeMesaSalesModal
                open={salesOpen}
                onClose={() => setSalesOpen(false)}
                onBuy={() => void buy()}
                buying={buying}
                active={active}
            />

            <QrDesignModal
                open={designOpen}
                onClose={() => !savingDesign && setDesignOpen(false)}
                currentTemplate={qrDesignTemplate}
                currentColor={qrDesignColor}
                bannerUrl={bannerUrl}
                logoUrl={logoUrl}
                saving={savingDesign}
                onSave={(template, color) => void saveDesign(template, color)}
            />

            <Modal open={editorOpen} onClose={() => setEditorOpen(false)}>
                <div className="border-b border-gray-100 px-6 py-5">
                    <h2 className="text-xl font-bold text-gray-900">
                        {editingTable ? "Editar mesa" : "Adicionar mesa"}
                    </h2>
                </div>
                <div className="px-6 py-6">
                    <Input
                        label="Nome da mesa"
                        value={tableName}
                        maxLength={80}
                        autoFocus
                        onChange={(event) => setTableName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") void saveTable();
                        }}
                    />
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-5">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditorOpen(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        loading={savingTable}
                        disabled={!tableName.trim()}
                        onClick={() => void saveTable()}
                    >
                        Salvar
                    </Button>
                </div>
            </Modal>

            <ConfirmModal
                open={Boolean(tableToDelete)}
                onClose={() => setTableToDelete(null)}
                onConfirm={() => void deleteTable()}
                title="Excluir mesa?"
                description={`O QR Code de ${tableToDelete?.name || "esta mesa"} deixará de funcionar.`}
                confirmLabel="Excluir mesa"
                isLoading={deletingTable}
                variant="danger"
            />

            <main className="min-h-screen bg-gray-50 px-4 pb-20 pt-8 sm:px-6">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                                Mesas
                            </h1>
                            <p className="mt-1 text-gray-600 2xl:text-lg">
                                Cadastre suas mesas e gere um QR Code para cada uma.
                            </p>
                        </div>
                        {active && (
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setDesignOpen(true)}
                                >
                                    <FontAwesomeIcon icon={faPalette} className="mr-2" />
                                    Configurar design
                                </Button>
                                <Button type="button" onClick={openNewTable}>
                                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                    Adicionar mesa
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <div
                            className={
                                active
                                    ? ""
                                    : "pointer-events-none select-none opacity-30 saturate-50"
                            }
                            aria-hidden={!active}
                        >
                            <Card className="mb-6 border border-gray-200 shadow-sm">
                                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                                    <div>
                                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                            <FontAwesomeIcon icon={faQrcode} />
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            QR Code universal
                                        </h2>
                                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                                            Use um único QR Code. Ao abrir o cardápio,
                                            o cliente escolhe a mesa antes de confirmar
                                            o pedido.
                                        </p>
                                        {universalUrl && (
                                            <div className="mt-5 max-w-2xl">
                                                <Input
                                                    label="Link universal"
                                                    value={universalDisplayUrl}
                                                    readOnly
                                                    locked
                                                    iconPosition="right"
                                                    icon={
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void copyUrl(
                                                                    universalUrl
                                                                )
                                                            }
                                                            aria-label="Copiar link universal"
                                                            title="Copiar link"
                                                            className="cursor-pointer text-gray-500 hover:text-brand"
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={faCopy}
                                                            />
                                                        </button>
                                                    }
                                                />
                                                <div className="mt-3 flex flex-wrap gap-3">
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() =>
                                                            void copyUrl(
                                                                universalUrl
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faCopy}
                                                            className="mr-2"
                                                        />
                                                        Copiar link
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() =>
                                                            void downloadQr(
                                                                universalUrl,
                                                                "qrcode-mesas-universal.png"
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faDownload}
                                                            className="mr-2"
                                                        />
                                                        Baixar QR Code
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() =>
                                                            void downloadDesignedQr(
                                                                universalUrl,
                                                                universalUrl,
                                                                "Universal",
                                                                "qrcode-mesas-universal-design.png"
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faImage}
                                                            className="mr-2"
                                                        />
                                                        Baixar com design
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-center">
                                        {universalUrl ? (
                                            <img
                                                src={qrImageUrl(universalUrl)}
                                                alt="QR Code universal das mesas"
                                                className="h-48 w-48 rounded-xl border border-gray-200 bg-white p-2"
                                            />
                                        ) : (
                                            <DemoQr />
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {(active ? tables : DEMO_TABLES).map((item) => {
                                    if (typeof item === "string") {
                                        return <DemoTableCard key={item} name={item} />;
                                    }

                                    const tableUrl = buildTableUrl(item.public_token);
                                    return (
                                        <Card
                                            key={item.id}
                                            className="border border-gray-200 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-brand">
                                                        <FontAwesomeIcon icon={faChair} />
                                                    </span>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900">
                                                            {item.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-500">
                                                            QR Code exclusivo
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditTable(item)
                                                        }
                                                        aria-label={`Editar ${item.name}`}
                                                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand"
                                                    >
                                                        <FontAwesomeIcon icon={faEdit} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setTableToDelete(item)
                                                        }
                                                        aria-label={`Excluir ${item.name}`}
                                                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="my-5 flex justify-center">
                                                <img
                                                    src={qrImageUrl(tableUrl)}
                                                    alt={`QR Code de ${item.name}`}
                                                    className="h-44 w-44 rounded-xl border border-gray-200 bg-white p-2"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant="secondary"
                                                    className="text-sm"
                                                    onClick={() =>
                                                        void copyUrl(tableUrl)
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faCopy}
                                                        className="mr-2"
                                                    />
                                                    Copiar
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    className="text-sm"
                                                    onClick={() =>
                                                        void downloadQr(
                                                            tableUrl,
                                                            `qrcode-${item.name
                                                                .toLowerCase()
                                                                .replace(/[^a-z0-9]+/g, "-")}.png`
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faDownload}
                                                        className="mr-2"
                                                    />
                                                    Baixar
                                                </Button>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                className="mt-2 w-full text-sm"
                                                onClick={() =>
                                                    void downloadDesignedQr(
                                                        tableUrl,
                                                        universalUrl,
                                                        item.name,
                                                        `qrcode-${item.name
                                                            .toLowerCase()
                                                            .replace(
                                                                /[^a-z0-9]+/g,
                                                                "-"
                                                            )}-design.png`
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faImage}
                                                    className="mr-2"
                                                />
                                                Baixar com design
                                            </Button>
                                        </Card>
                                    );
                                })}

                                {active && tables.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={openNewTable}
                                        className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center text-gray-500 transition hover:border-brand hover:text-brand"
                                    >
                                        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </span>
                                        <span className="font-semibold">
                                            Adicionar primeira mesa
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {!active && (
                            <div className="absolute inset-x-0 top-24 z-10 flex justify-center px-3 sm:top-36">
                                <Card className="w-full max-w-md border border-gray-200 text-center shadow-xl">
                                    <div className="relative mx-auto h-14 w-56 max-w-full">
                                        <Image
                                            src="/logos/QRCODECombinationMarkLogo_Brand.png"
                                            alt="iMenu QR Code Mesa"
                                            fill
                                            sizes="224px"
                                            className="object-contain"
                                        />
                                    </div>
                                    <h2 className="mt-4 text-xl font-bold text-gray-900">
                                        Ative o iMenu QR Code Mesa
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                                        Receba pedidos identificados por mesa, com um QR
                                        exclusivo ou universal. Várias pessoas podem pedir
                                        ao mesmo tempo.
                                    </p>
                                    <Button
                                        type="button"
                                        className="mt-5 w-full"
                                        onClick={openSalesModal}
                                    >
                                        Descobrir pedidos direto pela mesa
                                    </Button>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}

function DemoQr() {
    return (
        <div className="grid h-48 w-48 grid-cols-5 gap-2 rounded-xl border border-gray-200 bg-white p-5">
            {Array.from({ length: 25 }, (_, index) => (
                <span
                    key={index}
                    className={
                        index % 3 === 0 || index % 7 === 0
                            ? "rounded-sm bg-gray-800"
                            : "rounded-sm bg-gray-200"
                    }
                />
            ))}
        </div>
    );
}

function DemoTableCard({ name }: { name: string }) {
    return (
        <Card className="border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-brand">
                    <FontAwesomeIcon icon={faChair} />
                </span>
                <div>
                    <h3 className="font-bold text-gray-900">{name}</h3>
                    <p className="text-xs text-gray-500">QR Code exclusivo</p>
                </div>
            </div>
            <div className="my-5 flex justify-center">
                <DemoQr />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary">Copiar</Button>
                <Button variant="secondary">Baixar</Button>
            </div>
        </Card>
    );
}

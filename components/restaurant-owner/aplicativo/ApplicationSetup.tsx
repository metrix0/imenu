"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBell,
    faBellSlash,
    faCheckCircle,
    faCloudArrowDown,
    faMobileScreenButton,
    faPaperPlane,
    faTriangleExclamation,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

type BeforeInstallPromptEvent = Event & {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type ToastState = {
    id: number;
    message: string;
    type: "success" | "error" | "info";
};

const PUSH_DB_NAME = "imenu-push";
const PUSH_DB_VERSION = 1;
const PUSH_STORE_NAME = "settings";
const DEVICE_TOKEN_KEY = "deviceToken";

function isStandaloneMode(): boolean {
    if (typeof window === "undefined") return false;

    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );
}

function isIosDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function urlBase64ToUint8Array(value: string): Uint8Array {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);

    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function openPushDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PUSH_DB_NAME, PUSH_DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(PUSH_STORE_NAME)) {
                database.createObjectStore(PUSH_STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readStoredDeviceToken(): Promise<string | null> {
    const database = await openPushDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readonly");
        const request = transaction.objectStore(PUSH_STORE_NAME).get(DEVICE_TOKEN_KEY);

        request.onsuccess = () => resolve(String(request.result || "") || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
}

async function saveDeviceToken(deviceToken: string): Promise<void> {
    const database = await openPushDatabase();

    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
        transaction.objectStore(PUSH_STORE_NAME).put(deviceToken, DEVICE_TOKEN_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });

    database.close();
}

async function removeDeviceToken(): Promise<void> {
    const database = await openPushDatabase();

    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
        transaction.objectStore(PUSH_STORE_NAME).delete(DEVICE_TOKEN_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });

    database.close();
}

async function getAccessToken(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("Sua sessão expirou. Entre novamente no painel.");
    }

    return session.access_token;
}

export default function ApplicationSetup() {
    const { restaurantId } = useCreationStore();
    const [installPrompt, setInstallPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(false);
    const [notificationEnabled, setNotificationEnabled] = useState(false);
    const [supported, setSupported] = useState(true);
    const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
    const [busyAction, setBusyAction] = useState<
        "install" | "enable" | "test" | "disable" | null
    >(null);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [installInstructionsOpen, setInstallInstructionsOpen] =
        useState(false);

    const ios = useMemo(() => isIosDevice(), []);

    const showToast = useCallback(
        (message: string, type: ToastState["type"] = "info") => {
            setToast({ id: Date.now(), message, type });
        },
        []
    );

    const refreshStatus = useCallback(async () => {
        const canUsePush =
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window;

        setSupported(canUsePush);
        setInstalled(isStandaloneMode());

        if (!canUsePush) {
            setNotificationEnabled(false);
            return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
        });
        const subscription = await registration.pushManager.getSubscription();
        setNotificationEnabled(
            Notification.permission === "granted" && Boolean(subscription)
        );

        const configResponse = await fetch("/api/push/config", {
            cache: "no-store",
        });
        setServerConfigured(configResponse.ok);
    }, []);

    useEffect(() => {
        const handleInstallPrompt = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setInstalled(true);
            setInstallPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handleInstallPrompt);
        window.addEventListener("appinstalled", handleInstalled);
        void refreshStatus();

        return () => {
            window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, [refreshStatus]);

    const openInstallInstructions = () => {
        if (installed) {
            showToast("O iMenu já está instalado neste aparelho.", "success");
            return;
        }

        setInstallInstructionsOpen(true);
    };

    const installApplication = async () => {
        if (!installPrompt) return;

        setBusyAction("install");
        try {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;
            if (choice.outcome === "accepted") {
                setInstalled(true);
                setInstallInstructionsOpen(false);
                showToast("Aplicativo adicionado à tela inicial.", "success");
            }
            setInstallPrompt(null);
        } finally {
            setBusyAction(null);
        }
    };

    const enableNotifications = async () => {
        if (!restaurantId) {
            showToast("Não foi possível identificar seu restaurante.", "error");
            return;
        }

        if (!supported) {
            showToast("Este navegador não oferece notificações Web Push.", "error");
            return;
        }

        if (ios && !isStandaloneMode()) {
            showToast(
                "No iPhone, adicione o iMenu à Tela de Início antes de ativar as notificações.",
                "info"
            );
            setInstallInstructionsOpen(true);
            return;
        }

        setBusyAction("enable");
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                throw new Error(
                    "A permissão foi recusada. Libere as notificações nas configurações do aparelho."
                );
            }

            const configResponse = await fetch("/api/push/config", {
                cache: "no-store",
            });
            const config = await configResponse.json();
            if (!configResponse.ok || !config.publicKey) {
                throw new Error(
                    config.error || "As notificações ainda não foram configuradas no servidor."
                );
            }

            const registration = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
            });
            await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(
                        config.publicKey
                    ) as BufferSource,
                });
            }

            let deviceToken = await readStoredDeviceToken();
            if (!deviceToken) {
                deviceToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`.replace(
                    /-/g,
                    "_"
                );
                await saveDeviceToken(deviceToken);
            }

            const token = await getAccessToken();
            const response = await fetch("/api/push/subscriptions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    restaurantId,
                    deviceToken,
                    subscription: subscription.toJSON(),
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Não foi possível ativar as notificações.");
            }

            setNotificationEnabled(true);
            setServerConfigured(true);
            showToast("Notificações ativadas neste aparelho.", "success");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Não foi possível ativar as notificações.",
                "error"
            );
        } finally {
            setBusyAction(null);
        }
    };

    const sendTestNotification = async () => {
        if (!restaurantId) return;

        setBusyAction("test");
        try {
            const deviceToken = await readStoredDeviceToken();
            if (!deviceToken || !notificationEnabled) {
                throw new Error("Ative as notificações neste aparelho primeiro.");
            }

            const token = await getAccessToken();
            const response = await fetch("/api/push/test", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ restaurantId, deviceToken }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Não foi possível enviar o teste.");
            }

            showToast("Teste enviado. A notificação deve aparecer agora.", "success");
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : "Falha no teste.",
                "error"
            );
        } finally {
            setBusyAction(null);
        }
    };

    const disableNotifications = async () => {
        if (!restaurantId) return;

        setBusyAction("disable");
        try {
            const registration = await navigator.serviceWorker.getRegistration("/");
            const subscription = await registration?.pushManager.getSubscription();
            const deviceToken = await readStoredDeviceToken();

            if (deviceToken) {
                const token = await getAccessToken();
                await fetch("/api/push/subscriptions", {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ restaurantId, deviceToken }),
                });
            }

            await subscription?.unsubscribe();
            await removeDeviceToken();
            setNotificationEnabled(false);
            showToast("Notificações desativadas neste aparelho.", "success");
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Não foi possível desativar as notificações.",
                "error"
            );
        } finally {
            setBusyAction(null);
        }
    };

    return (
        <>
            {toast && (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <Modal
                open={installInstructionsOpen}
                onClose={() => setInstallInstructionsOpen(false)}
                className="max-w-lg"
            >
                <div className="relative p-6">
                    <button
                        type="button"
                        onClick={() => setInstallInstructionsOpen(false)}
                        className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Fechar instruções"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>

                    <h2 className="pr-10 text-xl font-semibold text-gray-900">
                        Adicionar o iMenu à tela inicial
                    </h2>

                    {ios ? (
                        <>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                                Siga estes passos no iPhone ou iPad:
                            </p>
                            <ol className="mt-5 space-y-3 text-sm leading-6 text-gray-700">
                                <li><strong>1.</strong> Abra o painel no <strong>Safari</strong>.</li>
                                <li><strong>2.</strong> Toque no botão de compartilhar.</li>
                                <li><strong>3.</strong> Escolha <strong>Adicionar à Tela de Início</strong>.</li>
                                <li><strong>4.</strong> Abra o novo ícone do iMenu e volte a esta página.</li>
                                <li><strong>5.</strong> Toque em <strong>Ativar notificações</strong>.</li>
                            </ol>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-sm leading-6 text-gray-600">
                                Siga estes passos no Android:
                            </p>
                            <ol className="mt-5 space-y-3 text-sm leading-6 text-gray-700">
                                <li><strong>1.</strong> Abra o painel no Chrome.</li>
                                {installPrompt ? (
                                    <>
                                        <li><strong>2.</strong> Toque em <strong>Instalar aplicativo</strong> abaixo.</li>
                                        <li><strong>3.</strong> Confirme a instalação.</li>
                                    </>
                                ) : (
                                    <>
                                        <li><strong>2.</strong> Abra o menu de três pontos do Chrome.</li>
                                        <li><strong>3.</strong> Escolha <strong>Adicionar à tela inicial</strong> ou <strong>Instalar app</strong>.</li>
                                    </>
                                )}
                                <li><strong>4.</strong> Abra o novo ícone do iMenu.</li>
                                <li><strong>5.</strong> Toque em <strong>Ativar notificações</strong> e depois em <strong>Enviar teste</strong>.</li>
                            </ol>

                            {installPrompt && (
                                <Button
                                    onClick={() => void installApplication()}
                                    loading={busyAction === "install"}
                                    className="mt-6 w-full"
                                >
                                    <FontAwesomeIcon
                                        icon={faMobileScreenButton}
                                        className="mr-2"
                                    />
                                    Instalar aplicativo
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </Modal>

            <div className="grid gap-5 lg:grid-cols-2">
                <Card className="border border-gray-100 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <FontAwesomeIcon icon={faMobileScreenButton} className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Adicionar como aplicativo
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-gray-600">
                                Crie um ícone do iMenu na tela inicial e abra o painel
                                em uma janela própria, sem precisar procurar o site.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <FontAwesomeIcon
                            icon={installed ? faCheckCircle : faCloudArrowDown}
                            className={installed ? "mr-2 text-green-600" : "mr-2 text-gray-500"}
                        />
                        {installed
                            ? "O iMenu já está instalado neste aparelho."
                            : "Ainda não detectamos o iMenu instalado neste aparelho."}
                    </div>

                    <Button
                        onClick={openInstallInstructions}
                        loading={false}
                        className="mt-5 w-full"
                    >
                        <FontAwesomeIcon icon={faMobileScreenButton} className="mr-2" />
                        {installed ? "Aplicativo instalado" : "Adicionar à tela inicial"}
                    </Button>
                </Card>

                <Card className="border border-gray-100 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                            <FontAwesomeIcon icon={faBell} className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Notificações em tempo real
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-gray-600">
                                Receba novos pedidos mesmo com o aplicativo fechado ou
                                o celular bloqueado.
                            </p>
                        </div>
                    </div>

                    <div
                        className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
                            notificationEnabled
                                ? "border-green-200 bg-green-50 text-green-800"
                                : "border-gray-200 bg-gray-50 text-gray-700"
                        }`}
                    >
                        <FontAwesomeIcon
                            icon={notificationEnabled ? faCheckCircle : faBellSlash}
                            className={
                                notificationEnabled
                                    ? "mr-2 text-green-600"
                                    : "mr-2 text-gray-500"
                            }
                        />
                        {notificationEnabled
                            ? "Notificações funcionando neste aparelho."
                            : "Notificações ainda não estão ativas neste aparelho."}
                    </div>

                    {serverConfigured === false && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <FontAwesomeIcon
                                icon={faTriangleExclamation}
                                className="mr-2"
                            />
                            O servidor ainda precisa das chaves VAPID para enviar avisos.
                        </div>
                    )}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button
                            onClick={() => void enableNotifications()}
                            loading={busyAction === "enable"}
                            className="flex-1"
                        >
                            <FontAwesomeIcon icon={faBell} className="mr-2" />
                            Ativar notificações
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => void sendTestNotification()}
                            loading={busyAction === "test"}
                            disabled={!notificationEnabled}
                            className="flex-1"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                            Enviar teste
                        </Button>
                    </div>

                    {notificationEnabled && (
                        <button
                            type="button"
                            onClick={() => void disableNotifications()}
                            disabled={busyAction === "disable"}
                            className="mt-4 w-full cursor-pointer text-center text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Desativar notificações neste aparelho
                        </button>
                    )}
                </Card>
            </div>

        </>
    );
}

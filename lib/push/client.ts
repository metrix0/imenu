"use client";

import { supabase } from "@/lib/database/supabaseClient";

const PUSH_DB_NAME = "imenu-push";
const PUSH_DB_VERSION = 1;
const PUSH_STORE_NAME = "settings";
const DEVICE_TOKEN_KEY = "deviceToken";

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

export async function readStoredDeviceToken(): Promise<string | null> {
    const database = await openPushDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readonly");
        const request = transaction.objectStore(PUSH_STORE_NAME).get(DEVICE_TOKEN_KEY);
        request.onsuccess = () => resolve(String(request.result || "") || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
}

export async function saveDeviceToken(deviceToken: string): Promise<void> {
    const database = await openPushDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
        transaction.objectStore(PUSH_STORE_NAME).put(deviceToken, DEVICE_TOKEN_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    database.close();
}

export async function removeDeviceToken(): Promise<void> {
    const database = await openPushDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
        transaction.objectStore(PUSH_STORE_NAME).delete(DEVICE_TOKEN_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    database.close();
}

export async function getAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error("Sua sessão expirou. Entre novamente no painel.");
    }
    return session.access_token;
}

export function urlBase64ToUint8Array(value: string): Uint8Array {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

type PushRegistrationStatus = { enabled: boolean; repaired: boolean };
const inFlight = new Map<string, Promise<PushRegistrationStatus>>();

async function reconcileOwnerPushSubscription(
    restaurantId: string
): Promise<PushRegistrationStatus> {
    const disabled = { enabled: false, repaired: false };
    if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) {
        return disabled;
    }

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const hadBrowserSubscription = Boolean(subscription);
    let deviceToken = await readStoredDeviceToken();
    const hadDeviceToken = Boolean(deviceToken);

    // An intentionally disabled or never-configured device has neither.
    if (!subscription && !deviceToken) return disabled;

    if (!subscription) {
        const configResponse = await fetch("/api/push/config", { cache: "no-store" });
        const config = await configResponse.json();
        if (!configResponse.ok || !config.publicKey) {
            throw new Error(config.error || "As notificações não estão configuradas.");
        }
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
        });
    }

    if (!deviceToken) {
        deviceToken = (crypto.randomUUID() + "-" + crypto.randomUUID()).replace(/-/g, "_");
        await saveDeviceToken(deviceToken);
    }

    const token = await getAccessToken();
    const verifyUrl = "/api/push/subscriptions?restaurantId=" + encodeURIComponent(restaurantId)
        + "&deviceToken=" + encodeURIComponent(deviceToken);
    const verifyResponse = await fetch(verifyUrl, {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
    });
    if (!verifyResponse.ok) {
        throw new Error("Não foi possível verificar as notificações neste aparelho.");
    }

    const existing = await verifyResponse.json();
    if (existing.endpoint === subscription.endpoint) {
        return { enabled: true, repaired: false };
    }

    // A removed server entry may represent a revoked push endpoint (HTTP 410).
    // Renew it instead of re-registering the same invalid endpoint indefinitely.
    if (!existing.endpoint && hadDeviceToken && hadBrowserSubscription) {
        const configResponse = await fetch("/api/push/config", { cache: "no-store" });
        const config = await configResponse.json();
        if (!configResponse.ok || !config.publicKey) {
            throw new Error(config.error || "As notificações não estão configuradas.");
        }

        if (!(await subscription.unsubscribe())) {
            throw new Error("Não foi possível renovar as notificações neste aparelho.");
        }
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
        });
    }

    const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ restaurantId, deviceToken, subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
        throw new Error("Não foi possível restaurar as notificações neste aparelho.");
    }

    return { enabled: true, repaired: true };
}

// Check this device's push status without registering, repairing, or changing it.
export async function hasOwnerPushSubscription(restaurantId: string): Promise<boolean> {
    if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) return false;

    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;

    const deviceToken = await readStoredDeviceToken();
    if (!deviceToken) return false;

    const token = await getAccessToken();
    const verifyUrl = "/api/push/subscriptions?restaurantId=" + encodeURIComponent(restaurantId)
        + "&deviceToken=" + encodeURIComponent(deviceToken);
    const response = await fetch(verifyUrl, {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
    });
    if (!response.ok) return false;
    const registered = await response.json();
    return registered.endpoint === subscription.endpoint;
}

export function ensureOwnerPushSubscription(
    restaurantId: string
): Promise<PushRegistrationStatus> {
    const pending = inFlight.get(restaurantId);
    if (pending) return pending;

    const current = reconcileOwnerPushSubscription(restaurantId);
    inFlight.set(restaurantId, current);
    void current.then(
        () => { if (inFlight.get(restaurantId) === current) inFlight.delete(restaurantId); },
        () => { if (inFlight.get(restaurantId) === current) inFlight.delete(restaurantId); }
    );
    return current;
}

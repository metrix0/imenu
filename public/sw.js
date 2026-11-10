const PUSH_DB_NAME = "imenu-push";
const PUSH_DB_VERSION = 1;
const PUSH_STORE_NAME = "settings";
const DEVICE_TOKEN_KEY = "deviceToken";
const RECENTLY_SHOWN_KEY = "recentlyShownNotifications";
const SHOWN_TTL_MS = 10 * 60 * 1000;
const processingPushes = new Map();

function openPushDatabase() {
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

async function readDeviceToken() {
    const database = await openPushDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readonly");
        const store = transaction.objectStore(PUSH_STORE_NAME);
        const request = store.get(DEVICE_TOKEN_KEY);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
}

// Remember displayed IDs across service-worker restarts, without changing the
// IndexedDB schema shared with the page. Keep only the 10-minute retry window.
async function recentlyShown(notificationId, remember = false) {
    const database = await openPushDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
            const store = transaction.objectStore(PUSH_STORE_NAME);
            const request = store.get(RECENTLY_SHOWN_KEY);
            request.onsuccess = () => {
                const now = Date.now();
                const entries = Array.isArray(request.result)
                    ? request.result.filter(entry => entry && entry.at > now - SHOWN_TTL_MS)
                    : [];
                const seen = entries.some(entry => entry.id === notificationId);
                if (remember) {
                    store.put([...entries.filter(entry => entry.id !== notificationId),
                        { id: notificationId, at: now }].slice(-200), RECENTLY_SHOWN_KEY);
                }
                resolve(seen);
            };
            request.onerror = () => reject(request.error);
            transaction.onerror = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

async function acknowledgePush(notificationId) {
    const deviceToken = await readDeviceToken();
    if (!deviceToken) return;
    const response = await fetch("/api/push/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ deviceToken, notificationId }),
    });
    if (!response.ok) throw new Error("Push acknowledgment returned " + response.status);
}

async function getNotificationPayload() {
    const deviceToken = await readDeviceToken().catch(() => null);

    if (!deviceToken) {
        return {
            title: "Novo aviso do iMenu",
            body: "Abra o aplicativo para conferir as novidades.",
            url: "/painel",
            tag: "imenu-generic",
        };
    }

    const response = await fetch(
        `/api/push/next?deviceToken=${encodeURIComponent(deviceToken)}`,
        {
            cache: "no-store",
            credentials: "same-origin",
        }
    );

    if (!response.ok) {
        throw new Error(`Notification payload returned ${response.status}`);
    }

    return response.json();
}

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    event.waitUntil(
        (async () => {
            let payload;

            try {
                payload = await getNotificationPayload();
            } catch (error) {
                console.error("[IMENU_PUSH] Failed to load payload:", error);
                payload = {
                    title: "Novo aviso do iMenu",
                    body: "Abra o aplicativo para conferir as novidades.",
                    url: "/painel",
                    tag: "imenu-generic",
                };
            }

            // An expired queue entry produces no alert, including after a delayed wake.
            if (!payload || (payload.expiresAt && payload.expiresAt <= Date.now())) return;

            const displayAndAcknowledge = async () => {
                const seen = payload.id
                    ? await recentlyShown(payload.id).catch(() => false)
                    : false;

                if (!seen) {
                    await self.registration.showNotification(payload.title, {
                        body: payload.body,
                        icon: "/logos/LogoMark_Brand.png",
                        badge: "/logos/LogoMark_Brand.png",
                        tag: payload.tag || undefined,
                        data: {
                            url: payload.url || "/painel",
                        },
                        vibrate: [180, 90, 180],
                        requireInteraction: true,
                    });
                    if (payload.id) {
                        await recentlyShown(payload.id, true).catch(error =>
                            console.error("[IMENU_PUSH] Could not remember display:", error)
                        );
                    }
                }
                if (payload.id) {
                    try {
                        await acknowledgePush(payload.id);
                    } catch (error) {
                        // The retry worker will wake the device again to retry this ACK.
                        console.error("[IMENU_PUSH] Could not acknowledge display:", error);
                    }
                }
            };

            if (!payload.id) {
                await displayAndAcknowledge();
                return;
            }

            // Concurrent wake-ups for one order share one display operation.
            const existing = processingPushes.get(payload.id);
            if (existing) {
                await existing;
                return;
            }
            const task = displayAndAcknowledge();
            processingPushes.set(payload.id, task);
            try {
                await task;
            } finally {
                processingPushes.delete(payload.id);
            }
        })()
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data?.url || "/painel",
        self.location.origin
    ).href;

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });

            for (const client of windows) {
                if ("focus" in client) {
                    if ("navigate" in client) {
                        await client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }

            return self.clients.openWindow(targetUrl);
        })()
    );
});

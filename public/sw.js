const PUSH_DB_NAME = "imenu-push";
const PUSH_DB_VERSION = 1;
const PUSH_STORE_NAME = "settings";
const DEVICE_TOKEN_KEY = "deviceToken";

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

async function getNotificationPayloads(event) {
    if (event.data) {
        const payload = event.data.json();
        if (payload && typeof payload.title === "string" && typeof payload.body === "string"
            && Number.isFinite(payload.expiresAt)) {
            // A delayed push must not retrieve another order's queue entry.
            return payload.expiresAt > Date.now() ? [payload] : [];
        }
    }
    const deviceToken = await readDeviceToken().catch(() => null);
    if (!deviceToken) return [];
    const response = await fetch(`/api/push/next?batch=1&deviceToken=${encodeURIComponent(deviceToken)}`, {
        cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Notification payload returned ${response.status}`);
    const payload = await response.json();
    return (payload?.notifications || (payload?.title ? [payload] : [])).map(notification => ({
        ...notification,
        expiresAt: notification.expiresAt || new Date(notification.created_at).getTime() + 300_000,
    })).filter(notification => notification.expiresAt > Date.now());
}

async function wasShown(id) {
    if (!id) return false;
    const database = await openPushDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(PUSH_STORE_NAME, "readonly");
        const request = transaction.objectStore(PUSH_STORE_NAME).get(`shown-${id}`);
        request.onsuccess = () => resolve(Boolean(request.result));
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
}

async function rememberShown(payload) {
    if (!payload.id) return;
    const database = await openPushDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(PUSH_STORE_NAME, "readwrite");
            const store = transaction.objectStore(PUSH_STORE_NAME);
            store.put(payload.expiresAt, `shown-${payload.id}`);
            const cursor = store.openCursor();
            cursor.onsuccess = () => {
                const current = cursor.result;
                if (!current) return;
                if (String(current.key).startsWith("shown-") && current.value <= Date.now()) current.delete();
                current.continue();
            };
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
}

async function acknowledge(payload) {
    if (!payload.id) return;
    try {
        const deviceToken = await readDeviceToken();
        if (!deviceToken) return;
        await fetch("/api/push/next", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceToken, notificationId: payload.id }), signal: AbortSignal.timeout(10_000),
        });
    } catch (error) { console.error("[IMENU_PUSH] Failed to acknowledge notification:", error); }
}

let pushQueue = Promise.resolve();

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    const acknowledgements = [];
    pushQueue = pushQueue.catch(() => undefined).then(async () => {
        const payloads = await getNotificationPayloads(event);
        for (const payload of payloads) {
            if (payload.expiresAt <= Date.now()) continue;
            const shown = await wasShown(payload.id).catch(() => false);
            await self.registration.showNotification(payload.title, {
                body: payload.body,
                icon: "/logos/LogoMark_Brand.png",
                badge: "/logos/LogoMark_Brand.png",
                tag: payload.tag || undefined,
                data: { url: payload.url || "/painel" },
                ...(shown ? { silent: true } : { vibrate: [180, 90, 180] }),
                requireInteraction: true,
                renotify: false,
                timestamp: new Date(payload.created_at).getTime() || Date.now(),
            });
            await rememberShown(payload).catch(error => console.error("[IMENU_PUSH] Failed to remember notification:", error));
            acknowledgements.push(acknowledge(payload));
        }
    });
    event.waitUntil(pushQueue.then(() => Promise.all(acknowledgements)).catch(error => console.error("[IMENU_PUSH] Failed to display notification:", error)));
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

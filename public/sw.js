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

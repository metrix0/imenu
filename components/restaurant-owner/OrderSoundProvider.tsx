"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

type OrderDingleDuration = "short" | "medium" | "long";

type OrderSoundContextValue = {
    soundEnabled: boolean;
    enableSound: () => Promise<boolean>;
};

export const ORDER_REALTIME_EVENT = "imenu:orders-realtime-updated";

const ORDER_DINGLE_DURATION_STORAGE_KEY = "imenu:order-dingle-duration";
const ORDER_DINGLE_DURATION_EVENT = "imenu:order-dingle-duration-changed";
const ORDER_DINGLE_DURATION_VERSION_KEY = "imenu:order-dingle-duration-version";
const ORDER_DINGLE_DURATION_VERSION = "2";

const OrderSoundContext = createContext<OrderSoundContextValue | null>(null);

function normalizeOrderDingleDuration(value: unknown): OrderDingleDuration {
    return value === "medium" || value === "long" ? value : "short";
}

function resolveOrderDingleDuration(fallback?: unknown): OrderDingleDuration {
    const storedDuration = window.localStorage.getItem(
        ORDER_DINGLE_DURATION_STORAGE_KEY,
    );
    const isCurrentVersion =
        window.localStorage.getItem(ORDER_DINGLE_DURATION_VERSION_KEY) ===
        ORDER_DINGLE_DURATION_VERSION;

    if (isCurrentVersion) {
        return normalizeOrderDingleDuration(storedDuration ?? fallback);
    }

    const legacyDuration = normalizeOrderDingleDuration(
        storedDuration ?? fallback,
    );
    const migratedDuration: OrderDingleDuration =
        legacyDuration === "long" ? "medium" : "short";

    window.localStorage.setItem(
        ORDER_DINGLE_DURATION_STORAGE_KEY,
        migratedDuration,
    );
    window.localStorage.setItem(
        ORDER_DINGLE_DURATION_VERSION_KEY,
        ORDER_DINGLE_DURATION_VERSION,
    );

    return migratedDuration;
}

function playAudioOnce(audio: HTMLAudioElement) {
    return new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
        };

        const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };

        const handleEnded = () => finish();
        const handleError = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("Falha ao reproduzir o som do pedido."));
        };

        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);
        audio.currentTime = 0;

        void audio.play().catch((error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        });
    });
}

function playAudioAfterDelay(audio: HTMLAudioElement, delayMs: number) {
    return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
            void playAudioOnce(audio).then(resolve).catch(reject);
        }, delayMs);
    });
}

async function playOrderDingleWithDuration(
    audio: HTMLAudioElement,
    duration: OrderDingleDuration,
) {
    if (duration === "short") {
        await playAudioOnce(audio);
        return;
    }

    const secondAudio = audio.cloneNode(true) as HTMLAudioElement;
    secondAudio.preload = "auto";

    const playbacks = [
        playAudioOnce(audio),
        playAudioAfterDelay(secondAudio, 1000),
    ];

    let thirdAudio: HTMLAudioElement | null = null;
    if (duration === "long") {
        thirdAudio = audio.cloneNode(true) as HTMLAudioElement;
        thirdAudio.preload = "auto";
        playbacks.push(playAudioAfterDelay(thirdAudio, 2000));
    }

    try {
        await Promise.all(playbacks);
    } finally {
        secondAudio.pause();
        secondAudio.currentTime = 0;
        thirdAudio?.pause();
        if (thirdAudio) thirdAudio.currentTime = 0;
    }
}

export function OrderSoundProvider({ children }: { children: ReactNode }) {
    const { restaurantId } = useCreationStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const knownOrderIdsRef = useRef<Set<string>>(new Set());
    const unlockingRef = useRef(false);
    const soundEnabledRef = useRef(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [orderDingleDuration, setOrderDingleDuration] =
        useState<OrderDingleDuration>("short");

    useEffect(() => {
        const audio = new Audio("/sounds/new-order.mp3");
        audio.preload = "auto";
        audioRef.current = audio;

        return () => {
            audio.pause();
            audio.currentTime = 0;
            audioRef.current = null;
        };
    }, []);

    const enableSound = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return false;
        if (soundEnabledRef.current) return true;
        if (unlockingRef.current) return false;

        unlockingRef.current = true;
        try {
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
            soundEnabledRef.current = true;
            setSoundEnabled(true);
            console.log("🔓 Audio unlocked");
            return true;
        } catch (error) {
            console.log("Still locked", error);
            return false;
        } finally {
            unlockingRef.current = false;
        }
    }, []);

    const playOrderDingle = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;

        await playOrderDingleWithDuration(audio, orderDingleDuration);
    }, [orderDingleDuration]);

    useEffect(() => {
        if (soundEnabled) return;

        const handleFirstClick = () => {
            void enableSound();
        };

        window.addEventListener("click", handleFirstClick, true);
        return () => window.removeEventListener("click", handleFirstClick, true);
    }, [enableSound, soundEnabled]);

    useEffect(() => {
        const applyStoredDuration = (fallback?: unknown) => {
            setOrderDingleDuration(resolveOrderDingleDuration(fallback));
        };

        const loadOrderDingleDuration = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            applyStoredDuration(
                session?.user.user_metadata?.order_dingle_duration,
            );
        };

        const handleDurationChange = (event: Event) => {
            const customEvent = event as CustomEvent<OrderDingleDuration>;
            setOrderDingleDuration(
                normalizeOrderDingleDuration(customEvent.detail),
            );
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === ORDER_DINGLE_DURATION_STORAGE_KEY) {
                applyStoredDuration();
            }
        };

        void loadOrderDingleDuration();
        window.addEventListener(
            ORDER_DINGLE_DURATION_EVENT,
            handleDurationChange,
        );
        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener(
                ORDER_DINGLE_DURATION_EVENT,
                handleDurationChange,
            );
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    useEffect(() => {
        knownOrderIdsRef.current.clear();
        if (!restaurantId) return;

        let active = true;
        const loadKnownOrders = async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("id")
                .eq("restaurant_id", restaurantId)
                .in("status", ["paid", "pending_physical_payment"]);

            if (!active) return;
            if (error) {
                console.error("Erro ao carregar pedidos conhecidos:", error);
                return;
            }

            for (const order of data || []) {
                knownOrderIdsRef.current.add(String(order.id));
            }
        };

        void loadKnownOrders();
        return () => {
            active = false;
        };
    }, [restaurantId]);

    useEffect(() => {
        if (!restaurantId) return;

        console.log("🔌 Conectando Realtime Pedidos para:", restaurantId);

        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                async (payload) => {
                    const isRelevantStatus = (status: string) =>
                        status === "paid" ||
                        status === "pending_physical_payment";

                    if (payload.eventType === "INSERT") {
                        const newOrder = payload.new as {
                            id?: string | number;
                            status?: string;
                        };
                        const newId = String(newOrder?.id);
                        const shouldPlaySound = isRelevantStatus(
                            String(newOrder?.status),
                        );

                        if (newId) {
                            const alreadySeen =
                                knownOrderIdsRef.current.has(newId);

                            if (
                                !alreadySeen &&
                                shouldPlaySound &&
                                soundEnabled &&
                                audioRef.current
                            ) {
                                try {
                                    await playOrderDingle();
                                } catch (error) {
                                    console.error(
                                        "❌ audio play failed in realtime",
                                        error,
                                    );
                                }
                            }

                            knownOrderIdsRef.current.add(newId);
                        }
                    } else if (payload.eventType === "UPDATE") {
                        const updated = payload.new as {
                            id?: string | number;
                            status?: string;
                        };
                        const id = String(updated?.id);
                        const isRelevant = isRelevantStatus(
                            String(updated?.status),
                        );
                        const alreadySeen =
                            knownOrderIdsRef.current.has(id);

                        if (
                            isRelevant &&
                            !alreadySeen &&
                            soundEnabled &&
                            audioRef.current
                        ) {
                            try {
                                await playOrderDingle();
                            } catch (error) {
                                console.error(
                                    "❌ audio play failed on update",
                                    error,
                                );
                            }
                        }

                        if (id) {
                            knownOrderIdsRef.current.add(id);
                        }
                    }

                    window.dispatchEvent(new Event(ORDER_REALTIME_EVENT));
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [playOrderDingle, restaurantId, soundEnabled]);

    return (
        <OrderSoundContext.Provider value={{ soundEnabled, enableSound }}>
            {children}
        </OrderSoundContext.Provider>
    );
}

export function useOrderSound() {
    const context = useContext(OrderSoundContext);
    if (!context) {
        throw new Error("useOrderSound must be used inside OrderSoundProvider");
    }
    return context;
}

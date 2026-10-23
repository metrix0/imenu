"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveState } from "@/components/ui/SaveStatus";

type State = { status: SaveState; error: string };
type Save<T> = (value: T) => Promise<unknown>;

// One request at a time; edits made during a request stay queued as a new snapshot.
export function createAutoSave<T>(notify: (state: State) => void, delay = 700) {
    type Entry = { value: T; save: Save<T>; generation: number; revision: number };
    let generation = 0;
    let revision = 0;
    let pending: Entry | null = null;
    let failed: Entry | null = null;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let state: State = { status: "idle", error: "" };

    const publish = (next: State) => {
        state = next;
        notify(next);
    };
    const clearTimer = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
    const flush = async (): Promise<void> => {
        if (running || !pending) return;
        const entry = pending;
        pending = null;
        running = true;
        try {
            await entry.save(entry.value);
            if (entry.generation === generation && entry.revision === revision) {
                publish({ status: "saved", error: "" });
            }
        } catch (error) {
            if (entry.generation === generation && entry.revision === revision) {
                failed = entry;
                publish({
                    status: "error",
                    error: error instanceof Error ? error.message : "Não foi possível salvar as alterações.",
                });
            }
        } finally {
            running = false;
            if (pending && timer === null) void flush();
        }
    };
    const schedule = (value: T, save: Save<T>) => {
        pending = { value, save, generation, revision: ++revision };
        failed = null;
        clearTimer();
        publish({ status: "saving", error: "" });
        timer = setTimeout(() => {
            timer = null;
            void flush();
        }, delay);
    };
    return {
        schedule,
        reset(status: SaveState = "idle") {
            clearTimer();
            generation++;
            revision++;
            pending = null;
            failed = null;
            publish({ status, error: "" });
        },
        flush() {
            clearTimer();
            return flush();
        },
        retry() {
            if (failed) schedule(failed.value, failed.save);
        },
        hasUnsavedChanges: () => state.status === "saving" || state.status === "error",
    };
}

export function useAutoSave<T>(scope: string | null, save: Save<T>) {
    const [state, setState] = useState<State>({ status: "idle", error: "" });
    const mounted = useRef(false);
    const controllerRef = useRef<ReturnType<typeof createAutoSave<T>> | null>(null);
    if (!controllerRef.current) {
        controllerRef.current = createAutoSave<T>((next) => {
            if (mounted.current) setState(next);
        });
    }
    const controller = controllerRef.current;

    useEffect(() => {
        mounted.current = true;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!controller.hasUnsavedChanges()) return;
            void controller.flush();
            event.preventDefault();
            event.returnValue = "";
        };
        const retry = () => controller.retry();
        window.addEventListener("beforeunload", beforeUnload);
        window.addEventListener("online", retry);
        window.addEventListener("focus", retry);
        return () => {
            mounted.current = false;
            window.removeEventListener("beforeunload", beforeUnload);
            window.removeEventListener("online", retry);
            window.removeEventListener("focus", retry);
            void controller.flush();
        };
    }, [controller]);

    useEffect(() => {
        controller.reset();
    }, [controller, scope]);

    // Capture the current restaurant's save callback with each edit.
    const schedule = useCallback((value: T) => controller.schedule(value, save), [controller, save]);
    return { ...state, schedule, reset: controller.reset };
}

"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

const SESSION_FLOOR_KEY = "imenu:auto-popup-priority-floor:v1";
const INITIAL_ARBITRATION_MS = 500;
const NON_CRITICAL_SESSION_FLOOR = 79;

export const AUTO_POPUP_PRIORITY = {
    promotion: 10,
    addonExpiry: 70,
    operational: 80,
    onboarding: 90,
    paymentSuccess: 100,
} as const;

type PopupCandidate = {
    priority: number;
    bypassSessionLimit: boolean;
    sequence: number;
};

type AutoPopupContextValue = {
    activeId: string | null;
    register: (
        id: string,
        priority: number,
        bypassSessionLimit: boolean
    ) => void;
    unregister: (id: string) => void;
    dismiss: (id: string) => void;
};

const AutoPopupContext = createContext<AutoPopupContextValue | null>(null);

export function AutoPopupProvider({ children }: { children: ReactNode }) {
    const [candidates, setCandidates] = useState<Record<string, PopupCandidate>>(
        {}
    );
    const candidatesRef = useRef(candidates);
    const nextSequenceRef = useRef(0);
    const [handledSequence, setHandledSequence] = useState(0);
    const [priorityFloor, setPriorityFloor] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        candidatesRef.current = candidates;
    }, [candidates]);

    useEffect(() => {
        try {
            const stored = Number(window.sessionStorage.getItem(SESSION_FLOOR_KEY));
            if (Number.isFinite(stored) && stored > 0) {
                setPriorityFloor(stored);
            }
        } catch {
            // Session limiting still works for the current render lifetime.
        }

        const timer = window.setTimeout(
            () => setReady(true),
            INITIAL_ARBITRATION_MS
        );
        return () => window.clearTimeout(timer);
    }, []);

    const register = useCallback(
        (id: string, priority: number, bypassSessionLimit: boolean) => {
            setCandidates((current) => {
                const existing = current[id];
                if (
                    existing &&
                    existing.priority === priority &&
                    existing.bypassSessionLimit === bypassSessionLimit
                ) {
                    return current;
                }

                nextSequenceRef.current += 1;
                return {
                    ...current,
                    [id]: {
                        priority,
                        bypassSessionLimit,
                        sequence: nextSequenceRef.current,
                    },
                };
            });
        },
        []
    );

    const unregister = useCallback((id: string) => {
        setCandidates((current) => {
            if (!current[id]) return current;
            const next = { ...current };
            delete next[id];
            return next;
        });
    }, []);

    const dismiss = useCallback((id: string) => {
        const candidate = candidatesRef.current[id];
        if (!candidate) return;

        const nextFloor =
            candidate.priority < AUTO_POPUP_PRIORITY.operational
                ? NON_CRITICAL_SESSION_FLOOR
                : candidate.priority;

        setPriorityFloor((current) => {
            const value = Math.max(current, nextFloor);
            try {
                window.sessionStorage.setItem(SESSION_FLOOR_KEY, String(value));
            } catch {
                // Current-page coordination still works without storage.
            }
            return value;
        });
        setHandledSequence(nextSequenceRef.current);
        unregister(id);
    }, [unregister]);

    const activeId = useMemo(() => {
        if (!ready) return null;

        return (
            Object.entries(candidates)
                .filter(
                    ([, candidate]) =>
                        candidate.sequence > handledSequence &&
                        (candidate.bypassSessionLimit ||
                            candidate.priority > priorityFloor)
                )
                .sort(([, left], [, right]) => {
                    if (right.priority !== left.priority) {
                        return right.priority - left.priority;
                    }
                    return left.sequence - right.sequence;
                })[0]?.[0] || null
        );
    }, [candidates, handledSequence, priorityFloor, ready]);

    const value = useMemo(
        () => ({
            activeId,
            register,
            unregister,
            dismiss,
        }),
        [activeId, dismiss, register, unregister]
    );

    return (
        <AutoPopupContext.Provider value={value}>
            {children}
        </AutoPopupContext.Provider>
    );
}

export function useAutoPopup(input: {
    id: string;
    priority: number;
    enabled: boolean;
    bypassSessionLimit?: boolean;
}) {
    const context = useContext(AutoPopupContext);
    if (!context) {
        throw new Error("useAutoPopup must be used inside AutoPopupProvider.");
    }

    const {
        activeId,
        register,
        unregister,
        dismiss: dismissPopup,
    } = context;
    const bypassSessionLimit = input.bypassSessionLimit === true;

    useEffect(() => {
        if (!input.enabled) {
            unregister(input.id);
            return;
        }

        register(input.id, input.priority, bypassSessionLimit);
        return () => unregister(input.id);
    }, [
        bypassSessionLimit,
        input.enabled,
        input.id,
        input.priority,
        register,
        unregister,
    ]);

    const dismiss = useCallback(
        () => dismissPopup(input.id),
        [dismissPopup, input.id]
    );

    return {
        open: input.enabled && activeId === input.id,
        dismiss,
    };
}

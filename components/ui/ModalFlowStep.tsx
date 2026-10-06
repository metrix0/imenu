"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ModalFlowStepProps = {
    children: ReactNode;
    stepKey: string;
    reverse?: boolean;
    animate?: boolean;
};

type TransitionState = {
    id: number;
    from: ReactNode;
    reverse: boolean;
    started: boolean;
};

export default function ModalFlowStep({
    children,
    stepKey,
    reverse = false,
    animate = false,
}: ModalFlowStepProps) {
    const currentKey = useRef(stepKey);
    const currentChildren = useRef(children);
    const transitionId = useRef(0);
    const [transition, setTransition] = useState<TransitionState | null>(null);

    useEffect(() => {
        if (currentKey.current !== stepKey || transition) return;
        currentChildren.current = children;
    }, [children, stepKey, transition]);

    useEffect(() => {
        if (currentKey.current === stepKey) return;

        const from = currentChildren.current;
        currentKey.current = stepKey;
        currentChildren.current = children;

        if (!animate) {
            setTransition(null);
            return;
        }

        const id = ++transitionId.current;
        setTransition({ id, from, reverse, started: false });

        let settleTimer = 0;
        const frame = window.requestAnimationFrame(() => {
            setTransition((current) =>
                current?.id === id ? { ...current, started: true } : current
            );
            settleTimer = window.setTimeout(() => {
                setTransition((current) =>
                    current?.id === id ? null : current
                );
            }, 300);
        });

        return () => {
            window.cancelAnimationFrame(frame);
            if (settleTimer) window.clearTimeout(settleTimer);
        };
        // A transition starts only when the active step changes. The values
        // captured here belong to that navigation event.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepKey]);

    const keyChanged = currentKey.current !== stepKey;
    if (!transition) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                {keyChanged && animate ? currentChildren.current : children}
            </div>
        );
    }

    const motion =
        "will-change-transform transition-transform duration-[300ms] ease-out motion-reduce:transition-none";
    const incomingHidden = transition.reverse
        ? "-translate-x-full"
        : "translate-x-full";
    const outgoingHidden = transition.reverse
        ? "translate-x-full"
        : "-translate-x-full";

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 flex h-full min-h-0 flex-col ${motion} ${transition.started ? outgoingHidden : "translate-x-0"}`}
            >
                {transition.from}
            </div>
            <div
                className={`absolute inset-0 flex h-full min-h-0 flex-col ${motion} ${transition.started ? "translate-x-0" : incomingHidden}`}
            >
                {children}
            </div>
        </div>
    );
}

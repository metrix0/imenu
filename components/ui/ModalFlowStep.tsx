"use client";

import { useEffect, useState, type ReactNode } from "react";

type ModalFlowStepProps = {
    children: ReactNode;
    reverse?: boolean;
    animate?: boolean;
};

export default function ModalFlowStep({
    children,
    reverse = false,
    animate = false,
}: ModalFlowStepProps) {
    const [visible, setVisible] = useState(!animate);
    const [settled, setSettled] = useState(!animate);

    useEffect(() => {
        if (!animate) {
            setVisible(true);
            setSettled(true);
            return;
        }

        setVisible(false);
        setSettled(false);
        let settleTimer = 0;
        const frame = window.requestAnimationFrame(() => {
            setVisible(true);
            settleTimer = window.setTimeout(() => setSettled(true), 220);
        });

        return () => {
            window.cancelAnimationFrame(frame);
            if (settleTimer) window.clearTimeout(settleTimer);
        };
    }, [animate]);

    const hiddenTransform = reverse ? "-translate-x-full" : "translate-x-full";
    const transition = animate && !settled
        ? `will-change-transform transition-transform duration-[220ms] ease-out motion-reduce:transition-none ${visible ? "translate-x-0" : hiddenTransform}`
        : "";

    return (
        <div
            className={`flex h-full min-h-0 flex-col ${transition}`}
        >
            {children}
        </div>
    );
}

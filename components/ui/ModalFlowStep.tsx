"use client";

import { useEffect, useState, type ReactNode } from "react";

type ModalFlowStepProps = {
    children: ReactNode;
    reverse?: boolean;
    animate?: boolean;
};

function AnimatedModalFlowStep({
    children,
    reverse = false,
}: Omit<ModalFlowStepProps, "animate">) {
    const [visible, setVisible] = useState(false);
    const [settled, setSettled] = useState(false);

    useEffect(() => {
        let settleTimer = 0;
        const frame = window.requestAnimationFrame(() => {
            setVisible(true);
            settleTimer = window.setTimeout(() => setSettled(true), 220);
        });

        return () => {
            window.cancelAnimationFrame(frame);
            if (settleTimer) window.clearTimeout(settleTimer);
        };
    }, []);

    if (settled) {
        return <div className="flex h-full min-h-0 flex-col">{children}</div>;
    }

    const hiddenTransform = reverse ? "-translate-x-full" : "translate-x-full";

    return (
        <div
            className={`flex h-full min-h-0 flex-col will-change-transform transition-transform duration-[220ms] ease-out motion-reduce:transition-none ${
                visible ? "translate-x-0" : hiddenTransform
            }`}
        >
            {children}
        </div>
    );
}

export default function ModalFlowStep({
    children,
    reverse = false,
    animate = true,
}: ModalFlowStepProps) {
    if (!animate) return <>{children}</>;

    return (
        <AnimatedModalFlowStep reverse={reverse}>
            {children}
        </AnimatedModalFlowStep>
    );
}

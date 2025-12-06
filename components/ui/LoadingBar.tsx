import React, { useEffect, useMemo, useRef, useState } from "react";

type LoadingBarProps = {
    progress?: number;
    indeterminate?: boolean;
    size?: "sm" | "md" | "lg";
    colorClass?: string;
    className?: string;
    showLabel?: boolean;
    fixed?: boolean;

    durationSeconds?: number;
};

export default function LoadingBar({
                                       progress = 0,
                                       indeterminate = false,
                                       size = "md",
                                       colorClass = "bg-brand",
                                       className = "",
                                       showLabel = false,
                                       fixed = false,
                                       durationSeconds,
                                   }: LoadingBarProps) {

    const [autoProgress, setAutoProgress] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTime = useRef<number | null>(null);

    // If durationSeconds is passed, animate 0% → 90%
    useEffect(() => {
        if (!durationSeconds || indeterminate) return;

        const target = 90;
        const durationMs = durationSeconds * 1000;

        const step = (now: number) => {
            if (!startTime.current) startTime.current = now;
            const elapsed = now - startTime.current;
            const pct = Math.min(1, elapsed / durationMs);
            setAutoProgress(Math.round(pct * target));

            if (pct < 1) {
                rafRef.current = requestAnimationFrame(step);
            }
        };

        rafRef.current = requestAnimationFrame(step);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            startTime.current = null;
        };
    }, [durationSeconds, indeterminate]);

    // effective progress
    const effectiveProgress = durationSeconds ? autoProgress : progress;

    const height = useMemo(() => {
        switch (size) {
            case "sm": return "h-1";
            case "lg": return "h-3";
            default: return "h-2";
        }
    }, [size]);

    const clamped = Math.max(0, Math.min(100, Math.round(effectiveProgress)));

    const filledStyle: React.CSSProperties = indeterminate
        ? { width: "30%" }
        : { width: `${clamped}%`, transition: "width 300ms ease" };

    useEffect(() => {
        if (document.getElementById("loading-bar-indeterminate-style")) return;
        const s = document.createElement("style");
        s.id = "loading-bar-indeterminate-style";
        s.innerHTML = `
      @keyframes loading-bar-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .loading-bar-indeterminate > .bar-inner {
        animation: loading-bar-slide 1.2s linear infinite;
      }
    `;
        document.head.appendChild(s);
    }, []);

    return (
        <div
            className={`${fixed ? "fixed top-0 left-0 right-0 z-50" : ""} ${className}`.trim()}
        >
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indeterminate ? undefined : clamped}
                className={`relative overflow-hidden rounded ${height} bg-gray-200/70`}
            >
                <div
                    className={`absolute left-0 top-0 bottom-0 ${colorClass} ${indeterminate ? "loading-bar-indeterminate overflow-hidden" : ""}`}
                    style={filledStyle}
                >
                    {indeterminate ? (
                        <div className="bar-inner h-full w-[200%] opacity-80"
                             style={{
                                 background: "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 100%)"
                             }} />
                    ) : null}
                </div>
            </div>

            {showLabel ? (
                <div className="mt-2 text-sm text-gray-600">
                    {indeterminate ? "Loading..." : `${clamped}%`}
                </div>
            ) : null}
        </div>
    );
}

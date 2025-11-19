"use client";

import { useState, useRef } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";
type TooltipSize = "line" | "medium";

export default function Tooltip({
                                    children,
                                    text,
                                    color = "bg-text",
                                    position = "top",
                                    padding = "px-2 py-1",
                                    size = "line",
                                }: {
    children: React.ReactNode;
    text: React.ReactNode;
    color?: string;
    padding?: string;
    size?: TooltipSize;
    position?: TooltipPosition;
}) {
    const [show, setShow] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // prevent flicker when crossing between element ↔ tooltip
    const safeShow = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShow(true);
        setVisible(true);
    };

    const safeHide = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShow(false);
            // delay "visibility: hidden" so animation can finish & no ghost area remains
            setTimeout(() => setVisible(false), 150);
        }, 100);
    };

    let positionClasses = "";
    let showClasses = "";
    let hideClasses = "";

    switch (position) {
        case "top":
            positionClasses = "left-1/2 -translate-x-1/2 bottom-full mb-1.5";
            showClasses = "opacity-100 translate-y-0";
            hideClasses = "opacity-0 translate-y-1";
            break;
        case "bottom":
            positionClasses = "left-1/2 -translate-x-1/2 top-full mt-1.5";
            showClasses = "opacity-100 translate-y-0";
            hideClasses = "opacity-0 -translate-y-1";
            break;
        case "right":
            positionClasses = "top-1/2 -translate-y-1/2 left-full ml-2";
            showClasses = "opacity-100 translate-x-0";
            hideClasses = "opacity-0 -translate-x-1";
            break;
        case "left":
            positionClasses = "top-1/2 -translate-y-1/2 right-full mr-2";
            showClasses = "opacity-100 translate-x-0";
            hideClasses = "opacity-0 translate-x-1";
            break;
    }

    let sizeClasses = "";
    switch (size) {
        case "line":
            sizeClasses = "whitespace-nowrap";
            break;
        case "medium":
            sizeClasses = "w-80 break-words"; // wrap text
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={safeShow}
            onMouseLeave={safeHide}
        >
            {children}

            <div
                className={`
                    absolute z-50 rounded text-white text-xs font-normal
                    pointer-events-auto select-none
                    transition-all duration-150
                    ${padding}
                    ${color}
                    ${positionClasses}
                    ${sizeClasses}
                    ${show ? showClasses : hideClasses}
                `}
                style={{
                    visibility: visible ? "visible" : "hidden",
                }}
                onMouseEnter={safeShow}
                onMouseLeave={safeHide}
            >
                {text}
            </div>
        </div>
    );
}

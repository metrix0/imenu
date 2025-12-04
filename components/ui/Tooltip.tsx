"use client";

import { useState, useRef, HTMLAttributes } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";
type TooltipSize = "line" | "medium";

type TooltipProps = {
    children: React.ReactNode;
    text: React.ReactNode;
    color?: string;
    padding?: string;
    size?: TooltipSize;
    position?: TooltipPosition;

    /** NEW props */
    className?: string;            // wrapper class
    tooltipClassName?: string;     // tooltip bubble class
    delayShow?: number;            // ms before showing
    delayHide?: number;            // ms before hiding
    disabled?: boolean;            // completely disable tooltip
} & HTMLAttributes<HTMLDivElement>; // allow any div props (id, style, data-*, etc.)

export default function Tooltip({
                                    children,
                                    text,
                                    color = "bg-text",
                                    position = "top",
                                    padding = "px-2 py-1",
                                    size = "line",

                                    /** new props */
                                    className = "",
                                    tooltipClassName = "",
                                    delayShow = 0,
                                    delayHide = 100,
                                    disabled = false,

                                    ...rest
                                }: TooltipProps) {
    const [show, setShow] = useState(false);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const delayShowRef = useRef<NodeJS.Timeout | null>(null);

    const safeShow = () => {
        if (disabled) return;

        clearTimeout(timeoutRef.current!);
        clearTimeout(delayShowRef.current!);

        delayShowRef.current = setTimeout(() => {
            setShow(true);
            setVisible(true);
        }, delayShow);
    };

    const safeHide = () => {
        clearTimeout(delayShowRef.current!);

        timeoutRef.current = setTimeout(() => {
            setShow(false);
            setTimeout(() => setVisible(false), 150);
        }, delayHide);
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

    let sizeClasses = size === "line" ? "whitespace-nowrap" : "w-80 break-words";

    return (
        <div
            className={`relative inline-block ${className}`}
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
                    ${tooltipClassName}
                    ${show ? showClasses : hideClasses}
                    ${className}
                `}
                style={{ visibility: visible ? "visible" : "hidden" }}
                onMouseEnter={safeShow}
                onMouseLeave={safeHide}
                {...rest}
            >
                {text}
            </div>
        </div>
    );
}

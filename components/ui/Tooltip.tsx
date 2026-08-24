"use client";

import { useEffect, useState, useRef, HTMLAttributes } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = "top" | "bottom" | "left" | "right";
type TooltipSize = "line" | "medium";

type TooltipProps = {
    children: React.ReactNode;
    text: React.ReactNode;
    color?: string;
    padding?: string;
    size?: TooltipSize;
    position?: TooltipPosition;
    parentClassName?: string;

    /** NEW props */
    className?: string;            // wrapper class
    tooltipClassName?: string;     // tooltip bubble class
    delayShow?: number;            // ms before showing
    delayHide?: number;            // ms before hiding
    disabled?: boolean;            // completely disable tooltip
    showOnClick?: boolean;         // show on click/tap as well as hover
    portal?: boolean;
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
                                    showOnClick = false,
                                    portal = true,
    parentClassName,

                                    ...rest
                                }: TooltipProps) {
    if(text === "") disabled = true
    const [show, setShow] = useState(false);
    const [visible, setVisible] = useState(false);
    const [portalPosition, setPortalPosition] = useState({ left: 0, top: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const delayShowRef = useRef<NodeJS.Timeout | null>(null);
    const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const safeShow = () => {
        if (disabled) return;

        clearTimeout(timeoutRef.current!);
        clearTimeout(delayShowRef.current!);
        clearTimeout(visibilityTimeoutRef.current!);

        if (portal && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current?.getBoundingClientRect();
            const tooltipWidth = tooltipRect?.width || 0;
            const tooltipHeight = tooltipRect?.height || 0;
            const gap = 6;
            const viewportPadding = 8;
            let left = rect.left + rect.width / 2 - tooltipWidth / 2;
            let top = rect.top - gap - tooltipHeight;

            if (position === "top") {
                top = rect.top - gap - tooltipHeight;
            } else if (position === "bottom") {
                top = rect.bottom + gap;
            } else if (position === "left") {
                left = rect.left - gap - tooltipWidth;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
            } else {
                left = rect.right + gap;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
            }

            setPortalPosition({
                left: Math.min(
                    Math.max(left, viewportPadding),
                    Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding)
                ),
                top: Math.min(
                    Math.max(top, viewportPadding),
                    Math.max(viewportPadding, window.innerHeight - tooltipHeight - viewportPadding)
                ),
            });
        }

        delayShowRef.current = setTimeout(() => {
            setShow(true);
            setVisible(true);
        }, delayShow);
    };

    const safeHide = () => {
        clearTimeout(timeoutRef.current!);
        clearTimeout(delayShowRef.current!);
        clearTimeout(visibilityTimeoutRef.current!);

        timeoutRef.current = setTimeout(() => {
            setShow(false);
            visibilityTimeoutRef.current = setTimeout(
                () => setVisible(false),
                150
            );
        }, delayHide);
    };

    const showForClick = () => {
        if (!showOnClick || disabled) return;

        safeShow();
        clearTimeout(timeoutRef.current!);
        timeoutRef.current = setTimeout(() => {
            setShow(false);
            visibilityTimeoutRef.current = setTimeout(
                () => setVisible(false),
                150
            );
        }, 1800);
    };

    useEffect(
        () => () => {
            clearTimeout(timeoutRef.current!);
            clearTimeout(delayShowRef.current!);
            clearTimeout(visibilityTimeoutRef.current!);
        },
        []
    );

    let positionClasses = "";
    let showClasses = "";
    let hideClasses = "";
    let bridgeClasses = "";

    switch (position) {
        case "top":
            positionClasses = "left-1/2 -translate-x-1/2 bottom-full mb-1.5";
            showClasses = "opacity-100 translate-y-0";
            hideClasses = "opacity-0 translate-y-1";
            bridgeClasses = "left-0 top-full h-2 w-full";
            break;

        case "bottom":
            positionClasses = "left-1/2 -translate-x-1/2 top-full mt-1.5";
            showClasses = "opacity-100 translate-y-0";
            hideClasses = "opacity-0 -translate-y-1";
            bridgeClasses = "bottom-full left-0 h-2 w-full";
            break;

        case "right":
            positionClasses = "top-1/2 -translate-y-1/2 left-full ml-2";
            showClasses = "opacity-100 translate-x-0";
            hideClasses = "opacity-0 -translate-x-1";
            bridgeClasses = "right-full top-0 h-full w-2";
            break;

        case "left":
            positionClasses = "top-1/2 -translate-y-1/2 right-full mr-2";
            showClasses = "opacity-100 translate-x-0";
            hideClasses = "opacity-0 translate-x-1";
            bridgeClasses = "left-full top-0 h-full w-2";
            break;
    }

    const sizeClasses = size === "line"
        ? "max-w-[calc(100vw-1rem)] whitespace-normal break-words"
        : "w-[min(20rem,calc(100vw-1rem))] break-words";

    const tooltip = (
        <div
                ref={tooltipRef}
                className={`
                    ${portal ? "fixed" : "absolute"} z-50 rounded text-xs font-normal text-white
                    pointer-events-auto select-none
                    transition-[opacity,transform] duration-150
                    ${padding}
                    ${color}
                    ${portal ? "" : positionClasses}
                    ${sizeClasses}
                    ${tooltipClassName}
                    ${show ? portal ? "opacity-100" : showClasses : portal ? "opacity-0" : hideClasses}
                    ${className}
                `}
                style={{
                    visibility: visible ? "visible" : "hidden",
                    ...(portal ? portalPosition : {}),
                }}
                onMouseEnter={safeShow}
                onMouseLeave={safeHide}
                {...rest}
            >
                {!portal && (
                    <span
                        aria-hidden="true"
                        className={`absolute ${bridgeClasses}`}
                    />
                )}
                {text}
            </div>
    );

    return (
        <div
            ref={triggerRef}
            className={`relative inline-block ${parentClassName}`}
            onMouseEnter={safeShow}
            onMouseLeave={safeHide}
            onClick={showForClick}
        >
            {children}
            {portal && typeof document !== "undefined"
                ? createPortal(tooltip, document.body)
                : tooltip}
        </div>
    );
}

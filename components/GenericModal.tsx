"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Diagnostic RestaurantCartWarningModal
 * - paste this file exactly over components/consumidor/RestaurantCartWarningModal.tsx
 * - open browser DevTools Console and watch logs while you try to drag
 *
 * Purpose: confirm whether pointer/touch events are firing and whether any layer is stealing them.
 */

export default function RestaurantCartWarningModal({
                                                       modalVisible,
                                                       setModalVisible,
                                                       setCartOpenAction,
                                                       restaurant,
                                                   }: {
    modalVisible: boolean;
    setModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setCartOpenAction: () => void;
    restaurant: any;
}) {
    const [cartWarningVisible, setCartWarningVisible] = useState(false);
    const [cartWarningClosing, setCartWarningClosing] = useState(false);
    const [backdropVisible, setBackdropVisible] = useState(false);

    const [closedByDrag, setClosedByDrag] = useState(false);
    const [translateY, setTranslateYState] = useState(0);
    const [dragging, setDragging] = useState(false);

    const translateRef = useRef(0);
    const startYRef = useRef<number | null>(null);
    const activePointerRef = useRef<number | null>(null);

    const handleRef = useRef<HTMLDivElement | null>(null);
    const CLOSE_THRESHOLD = 120;

    const setTranslate = (v: number) => {
        translateRef.current = v;
        setTranslateYState(v);
    };

    useEffect(() => {
        if (modalVisible) {
            showCartWarning(true);
        }
    }, [modalVisible]);

    function showCartWarning(show: boolean) {
        if (!show) {
            setBackdropVisible(false);
            setCartWarningClosing(true);
            setTimeout(() => {
                setCartWarningVisible(false);
                setCartWarningClosing(false);
                setTranslate(0);
                setClosedByDrag(false);
                setModalVisible(false);
            }, 220);
        } else {
            setCartWarningVisible(true);
            requestAnimationFrame(() => setBackdropVisible(true));
        }
    }

    // ----------------------------------------------------
    // Debug helpers - logs a single consistent prefix line
    // ----------------------------------------------------
    const log = (...args: any[]) => {
        // eslint-disable-next-line no-console
        console.log("[RCW-MODAL]", ...args);
    };

    // attach robust window-level pointermove/up listeners when pointer down
    const attachWindowPointerListeners = () => {
        const onMove = (ev: PointerEvent) => {
            if (activePointerRef.current !== null && ev.pointerId !== activePointerRef.current) return;
            // mirror handle move
            if (startYRef.current === null) return;
            const diff = ev.clientY - startYRef.current;
            if (diff <= 0) {
                setTranslate(0);
                log("window pointermove diff<=0");
                return;
            }
            const dampened = diff > 300 ? 300 + (diff - 300) * 0.2 : diff;
            setTranslate(dampened);
            log("window pointermove", ev.pointerId, "diff", Math.round(diff), "translate", Math.round(dampened));
        };

        const onUp = (ev: PointerEvent) => {
            if (activePointerRef.current !== null && ev.pointerId !== activePointerRef.current) return;
            cleanupWindowPointerListeners();
            // handle up logic
            const final = translateRef.current;
            activePointerRef.current = null;
            startYRef.current = null;
            setDragging(false);
            log("window pointerup final", final);
            if (final >= CLOSE_THRESHOLD) {
                // close sequence
                setClosedByDrag(true);
                setCartWarningClosing(true);
                setBackdropVisible(false);
                const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
                setTranslate(offscreen);
                setTimeout(() => {
                    setCartWarningVisible(false);
                    setCartWarningClosing(false);
                    setTranslate(0);
                    setClosedByDrag(false);
                    setModalVisible(false);
                }, 260);
                return;
            }
            setTranslate(0);
        };

        // use capture to try to intercept events before other handlers
        window.addEventListener("pointermove", onMove, { capture: true });
        window.addEventListener("pointerup", onUp, { capture: true });
        // store handlers so we can remove later
        (attachWindowPointerListeners as any)._onMove = onMove;
        (attachWindowPointerListeners as any)._onUp = onUp;
        log("attached window listeners");
    };

    const cleanupWindowPointerListeners = () => {
        const onMove = (attachWindowPointerListeners as any)._onMove;
        const onUp = (attachWindowPointerListeners as any)._onUp;
        if (onMove) window.removeEventListener("pointermove", onMove, { capture: true });
        if (onUp) window.removeEventListener("pointerup", onUp, { capture: true });
        (attachWindowPointerListeners as any)._onMove = null;
        (attachWindowPointerListeners as any)._onUp = null;
        log("cleaned window listeners");
    };

    // -----------------------
    // HANDLE pointer events
    // -----------------------
    const handlePointerDown = (e: React.PointerEvent) => {
        log("pointerdown", "id", e.pointerId, "type", e.pointerType, "buttons", (e as any).buttons);
        // only start for primary mouse button OR touch/pen
        if (e.pointerType === "mouse" && (e as any).buttons !== 1) {
            log("pointerdown ignored - not primary");
            return;
        }

        e.preventDefault();
        try {
            // capture on the handle element (currentTarget)
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            log("setPointerCapture on currentTarget");
        } catch (err) {
            log("setPointerCapture failed", err);
        }

        activePointerRef.current = e.pointerId;
        startYRef.current = e.clientY;
        setDragging(true);
        setTranslate(0);

        // temporarily disable backdrop pointer events while dragging
        // (so backdrop can't steal events)
        // also attach window-level fallback listeners to be sure we receive moves
        attachWindowPointerListeners();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // guard: only track active pointer
        if (activePointerRef.current !== e.pointerId) return;
        if (startYRef.current === null) return;

        const diff = e.clientY - startYRef.current;
        log("handle pointermove", "id", e.pointerId, "diff", Math.round(diff));

        if (diff <= 0) {
            setTranslate(0);
            return;
        }
        const dampened = diff > 300 ? 300 + (diff - 300) * 0.2 : diff;
        setTranslate(dampened);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (activePointerRef.current !== e.pointerId) return;
        log("pointerup", "id", e.pointerId);

        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            log("released pointer capture");
        } catch (err) {
            log("releasePointerCapture failed", err);
        }

        // cleanup window listeners
        cleanupWindowPointerListeners();

        const final = translateRef.current;
        activePointerRef.current = null;
        startYRef.current = null;
        setDragging(false);

        log("pointerup final", final);

        if (final >= CLOSE_THRESHOLD) {
            // close by drag
            setClosedByDrag(true);
            setCartWarningClosing(true);
            setBackdropVisible(false);
            const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
            setTranslate(offscreen);
            setTimeout(() => {
                setCartWarningVisible(false);
                setCartWarningClosing(false);
                setTranslate(0);
                setClosedByDrag(false);
                setModalVisible(false);
            }, 260);
            return;
        }
        setTranslate(0);
    };

    // touch fallbacks (also log)
    const handleTouchStart = (e: React.TouchEvent) => {
        log("touchstart", e.touches[0]?.clientY);
        startYRef.current = e.touches[0]?.clientY ?? null;
        setDragging(true);
        setTranslate(0);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (startYRef.current === null) return;
        const diff = e.touches[0].clientY - startYRef.current;
        log("touchmove", Math.round(diff));
        if (diff <= 0) {
            setTranslate(0);
            return;
        }
        const dampened = diff > 300 ? 300 + (diff - 300) * 0.2 : diff;
        setTranslate(dampened);
    };
    const handleTouchEnd = () => {
        log("touchend final", translateRef.current);
        const final = translateRef.current;
        startYRef.current = null;
        setDragging(false);
        if (final >= CLOSE_THRESHOLD) {
            setClosedByDrag(true);
            setCartWarningClosing(true);
            setBackdropVisible(false);
            const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
            setTranslate(offscreen);
            setTimeout(() => {
                setCartWarningVisible(false);
                setCartWarningClosing(false);
                setTranslate(0);
                setClosedByDrag(false);
                setModalVisible(false);
            }, 260);
            return;
        }
        setTranslate(0);
    };

    // backdrop click logging
    const handleBackdropClick = () => {
        log("backdrop click");
        showCartWarning(false);
    };

    // ensure mount only when visible (so animation plays)
    if (!cartWarningVisible) return null;

    return (
        <>
            <div
                onClick={handleBackdropClick}
                style={{ pointerEvents: dragging ? "none" : backdropVisible ? "auto" : "none" }}
                className={`fixed inset-0 z-49 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${backdropVisible ? "opacity-100" : "opacity-0"}`}
            />

            <div
                className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white rounded-t-2xl shadow-xl
        h-[30vh] p-6
        ${closedByDrag ? "" : cartWarningClosing ? "animate-slide-down" : "animate-slide-up"}
    `}
                style={{
                    transform: `translateY(${translateRef.current}px)`,
                    transition: dragging ? "none" : "transform 250ms ease",

                    // ⭐ overrides global animation transform during drag
                    animation: dragging ? "none" : undefined,
                }}
            >

                {/* DRAG HANDLE */}
                <div
                    ref={handleRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ touchAction: "none", zIndex: 99999 }}
                    className="w-full h-6 -mt-4 mb-2 flex justify-center items-center cursor-grab active:cursor-grabbing"
                >
                    <div className="w-10 h-1.5 rounded-full bg-gray-300" />
                </div>

                {/* Content */}
                <div className="text-center">
                    <div className="text-text text-md font-medium mb-2 mt-2">Pedido identificado.</div>
                    <p className="text-gray-500 mb-4 text-sm">
                        Você realizou um pedido aqui recentemente, gostaria de ir até a página deste pedido?
                    </p>

                    <button
                        className="bg-brand text-white w-full py-3 rounded-lg text-sm"
                        onClick={() => {
                            log("button clicked -> go to order");
                            showCartWarning(false);
                            try { setCartOpenAction(); } catch (err) { log("setCartOpenAction error", err); }
                        }}
                    >
                        Ir ao pedido
                    </button>

                    <p className="text-brand text-sm mt-4" onClick={() => { log("no thanks clicked"); showCartWarning(false); }}>
                        Não, obrigado
                    </p>
                </div>
            </div>
        </>
    );
}

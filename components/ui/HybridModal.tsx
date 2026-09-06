import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

type DraggableModalProps =  React.HTMLAttributes<HTMLDivElement> & {
    height?: number;
    handle?: boolean;
    open: boolean;
    onClose: () => void;
    xPadding?: boolean;
    contentClassName?: string;
    children: React.ReactNode;
};

export default function DraggableModal({
                                           height = 0.9,
                                           handle = true,
                                           open,
                                           onClose,
                                           xPadding = true,
                                           contentClassName,
                                           children,
                                            ...props
                                       }: DraggableModalProps) {
    const startY = useRef(0);
    const currentY = useRef(0);
    const closingRef = useRef(false); // 🔥 prevents double-close

    const [translateY, setTranslateY] = useState(1000);
    const [animating, setAnimating] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);


    // === Open / Close animation ===
    useEffect(() => {
        if (open) {
            closingRef.current = false;
            requestAnimationFrame(() => {
                setAnimating(true);
                setTranslateY(0);
            });
        } else {
            // triggered only from parent (not drag)
            closingRef.current = true;
            setAnimating(true);
            setTranslateY(1000);
        }
    }, [open]);

    // === Shared start logic ===
    const handleStart = (clientY: number) => {
        if (closingRef.current) return; // block dragging if closing

        startY.current = clientY;
        currentY.current = 0;

        setAnimating(false);

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onEnd);
        document.addEventListener("touchmove", onMove as any, { passive: false });
        document.addEventListener("touchend", onEnd);
    };

    const onMouseStart = (e: React.MouseEvent<HTMLDivElement>) => {
        handleStart(e.clientY);
    };

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        handleStart(e.touches[0].clientY);
    };

    const onPanelTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        const panelTop = e.currentTarget.getBoundingClientRect().top;

        if (touch.clientY - panelTop <= 28) {
            handleStart(touch.clientY);
        }
    };

    // === Move ===
    const onMove = (e: MouseEvent | TouchEvent) => {
        const y = "touches" in e ? e.touches[0].clientY : e.clientY;
        const diff = y - startY.current;

        if (diff > 0) {
            currentY.current = diff;
            setTranslateY(diff);
        }

        if ("cancelable" in e && e.cancelable) e.preventDefault();
    };

    // === End ===
    const onEnd = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove as any);
        document.removeEventListener("touchend", onEnd);

        setAnimating(true);

        if (currentY.current > 120) {
            closingRef.current = true;
            setTranslateY(1000);

            // 🔥 WAIT for animation before unmount
            setTimeout(onClose, 250);
        } else {
            setTranslateY(0);
        }
    };

    // === Backdrop click ===
    const backdropClose = () => {
        if (closingRef.current) return;

        closingRef.current = true;

        setAnimating(true);
        setTranslateY(1000);

        setTimeout(onClose, 250); // match transition
    };

    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        if (!open || isDesktop) return;

        const body = document.body;
        const html = document.documentElement;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyOverscroll = body.style.overscrollBehavior;
        const previousHtmlOverscroll = html.style.overscrollBehavior;

        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";
        html.style.overscrollBehavior = "none";

        return () => {
            body.style.overflow = previousBodyOverflow;
            body.style.overscrollBehavior = previousBodyOverscroll;
            html.style.overscrollBehavior = previousHtmlOverscroll;
        };
    }, [open, isDesktop]);


    return (
        <>{isDesktop ?
                    <Modal open={open} onClose={onClose} className={props.className}>
                        {children}
                    </Modal>
            :
        <div
            className={`fixed inset-0 z-[51] transition-opacity duration-300 ${
                open ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ background: "rgba(0,0,0,0.35)", overscrollBehavior: "none" }}
            onClick={backdropClose}
        >
            <div
                {...props}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onPanelTouchStart}
                className={`fixed left-0 right-0 mx-auto bg-white rounded-t-xl overflow-hidden ${props.className ?? ""}`}
                style={{
                    height: `${height * 100}dvh`,
                    bottom: 0,
                    transform: `translateY(${translateY}px)`,
                    transition: animating ? "transform 0.25s ease-out" : "none",
                    overscrollBehaviorY: "contain",
                    ...(props.style ?? {}),
                }}
            >
                {/* Invisible drag zone */}
                <div
                    onMouseDown={onMouseStart}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                        onTouchStart(e);
                    }}
                    className="absolute left-0 top-0 w-full"
                    style={{
                        height: "28px",
                        zIndex: 30,
                        cursor: "grab",
                        touchAction: "none",
                    }}
                />

                {handle && (
                    <div className="w-full flex justify-center py-3">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                    </div>
                )}

                <div
                    className={`overflow-y-auto h-full pb-32 ${xPadding ? "px-4" : ""} ${contentClassName ?? ""}`}
                    style={{ overscrollBehaviorY: "contain" }}
                >
                    {children}
                </div>
            </div>
        </div>}</>
    );
}
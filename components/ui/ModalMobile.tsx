import { useEffect, useRef, useState } from "react";

type DraggableModalProps = {
    height?: number;
    handle?: boolean;
    open: boolean;
    onClose: () => void;
    xPadding?: boolean;
    children: React.ReactNode;
};

export default function DraggableModal({
                                           height = 0.9,
                                           handle = true,
                                           open,
                                           onClose,
                                           xPadding = true,
                                           children,
                                       }: DraggableModalProps) {
    const startY = useRef(0);
    const currentY = useRef(0);
    const closingRef = useRef(false); // 🔥 prevents double-close

    const [translateY, setTranslateY] = useState(1000);
    const [animating, setAnimating] = useState(false);

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

    return (
        <div
            className={`fixed inset-0 z-50 transition-opacity duration-300 ${
                open ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={backdropClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="fixed left-0 right-0 mx-auto bg-white rounded-t-xl"
                style={{
                    height: `${height * 100}vh`,
                    bottom: 0,
                    transform: `translateY(${translateY}px)`,
                    transition: animating ? "transform 0.25s ease-out" : "none",
                }}
            >
                {/* Invisible drag zone */}
                <div
                    onMouseDown={onMouseStart}
                    onTouchStart={onTouchStart}
                    className="absolute left-0 top-0 w-full"
                    style={{
                        height: "28px",
                        zIndex: 30,
                        cursor: "grab",
                    }}
                />

                {handle && (
                    <div className="w-full flex justify-center py-3">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                    </div>
                )}

                <div className={`overflow-y-auto h-full pb-32 ${xPadding ? "px-4" : ""}`}>
                    {children}
                </div>
            </div>
        </div>
    );
}

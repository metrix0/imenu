"use client";
import { useEffect, useState } from "react";

interface ToastProps {
    message: string;
    duration?: number;
    type?: "success" | "error" | "info";
    onClose?: () => void;
}

export default function Toast({
                                  message,
                                  duration = 3000,
                                  type = "info",
                                  onClose,
                              }: ToastProps) {
    const [visible, setVisible] = useState(true);
    const [animateOut, setAnimateOut] = useState(false);
    const [animateIn, setAnimateIn] = useState(false); // ⭐ NEW

    useEffect(() => {
        // ⭐ trigger IN animation on next tick
        setTimeout(() => setAnimateIn(true), 10);

        const timer = setTimeout(() => {
            setAnimateOut(true);
            setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!visible) return null;

    const colors = {
        success: "bg-green-600 text-white",
        error: "bg-red-600 text-white",
        info: "bg-gray-800 text-white",
    };

    return (
        <div
            className={`
                fixed top-4 left-4 z-5000 px-4 py-2 rounded-lg shadow-lg
                transition-all duration-300
                ${colors[type]}
                ${
                animateOut
                    ? "-translate-x-full opacity-0"
                    : animateIn
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-full opacity-0"
            }
            `}
        >
            {message}
        </div>
    );
}

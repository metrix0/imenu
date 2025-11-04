"use client";
import { useEffect, useState } from "react";

interface ToastProps {
    message: string;
    duration?: number; // milliseconds
    type?: "success" | "error" | "info";
    onClose?: () => void; // ✅ callback to parent
}

export default function Toast({
                                  message,
                                  duration = 3000,
                                  type = "info",
                                  onClose,
                              }: ToastProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            onClose?.(); // ✅ tell parent we closed
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
            className={`fixed top-4 left-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${colors[type]}`}
        >
            {message}
        </div>
    );
}

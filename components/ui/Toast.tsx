"use client";
import { useEffect, useState } from "react";

interface ToastProps { message: string; duration?: number; type?: "success" | "error" | "info"; onClose?: () => void; }

export default function Toast({ message, duration = 3000, type = "info", onClose }: ToastProps) {
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(true);

    useEffect(() => {
        const enter = requestAnimationFrame(() => setVisible(true));
        const leave = window.setTimeout(() => setVisible(false), duration);
        const remove = window.setTimeout(() => { setMounted(false); onClose?.(); }, duration + 300);
        return () => { cancelAnimationFrame(enter); clearTimeout(leave); clearTimeout(remove); };
    }, [duration, onClose]);

    if (!mounted) return null;
    const colors = { success: "bg-green-600", error: "bg-red-600", info: "bg-gray-800" };
    return (
        <div className={`fixed left-1/2 top-4 z-[5000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg px-4 py-3 text-center text-sm font-medium text-white shadow-xl transition-all duration-300 sm:left-4 sm:w-auto sm:max-w-lg sm:translate-x-0 sm:text-left ${colors[type]} ${visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0 sm:-translate-x-full sm:translate-y-0"}`} role="status" aria-live="polite">
            <span className="break-words">{message}</span>
        </div>
    );
}

import { Check, CircleAlert, LoaderCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export default function SaveStatus({ status, className = "" }: { status: SaveState; className?: string }) {
    if (status === "idle") return null;
    const Icon = status === "saving" ? LoaderCircle : status === "error" ? CircleAlert : Check;
    return (
        <span role="status" aria-live="polite" aria-atomic="true" data-ui="save-status" data-state={status}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${status === "error" ? "border-red-200 bg-red-50 text-red-700" : status === "saving" ? "border-gray-200 bg-gray-50 text-gray-600" : "border-green-200 bg-green-50 text-green-800"} ${className}`}>
            <Icon size={14} aria-hidden="true" className={status === "saving" ? "animate-spin motion-reduce:animate-none" : ""} />
            {status === "saving" ? "Salvando..." : status === "error" ? "Não salvo" : "Tudo salvo"}
        </span>
    );
}

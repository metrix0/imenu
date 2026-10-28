"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

function SaveStatusBadge({ status, className = "" }: { status: SaveState; className?: string }) {
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

type Entry = { status: SaveState; changed: boolean };
export function aggregatePageSaveStatus(entries: Record<string, Entry>): SaveState {
    const active = Object.values(entries).filter(entry => entry.changed);
    return !active.length ? "idle"
        : active.some(entry => entry.status === "error" || entry.status === "idle") ? "error"
        : active.some(entry => entry.status === "saving") ? "saving" : "saved";
}
const PageSaveStateContext = createContext<SaveState>("idle");
const PageSaveContext = createContext<((id: string, status: SaveState) => void) | null>(null);

// A page owns one indicator. Sources report independently and keep failures visible.
export function PageSaveStatusProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<Record<string, Entry>>({});
    const report = useCallback((id: string, status: SaveState) => {
        setEntries(previous => {
            const old = previous[id];
            const changed = Boolean(old?.changed || status === "saving");
            if (old?.status === status && old.changed === changed) return previous;
            return { ...previous, [id]: { status, changed } };
        });
    }, []);
    const status = aggregatePageSaveStatus(entries);
    return <PageSaveContext.Provider value={report}>
        <PageSaveStateContext.Provider value={status}>{children}</PageSaveStateContext.Provider>
    </PageSaveContext.Provider>;
}

export default function SaveStatus({ status, className = "" }: { status: SaveState; className?: string }) {
    const report = useContext(PageSaveContext);
    const id = useId();
    useEffect(() => { report?.(id, status); }, [report, id, status]);
    // Retain a source's last result if its editor is collapsed/unmounted.
    return report ? null : <SaveStatusBadge status={status} className={className} />;
}

// Keep the page status inline with its heading on every screen size.
export function PageSaveHeader({ children }: { children: ReactNode }) {
    const status = useContext(PageSaveStateContext);
    return <div className="flex min-w-0 items-start justify-between gap-4" data-ui="page-save-header">
        <div className="min-w-0 flex-1">{children}</div>
        {status !== "idle" && <div className="shrink-0 pt-1" data-ui="page-save-status">
            <SaveStatusBadge status={status} />
        </div>}
    </div>;
}

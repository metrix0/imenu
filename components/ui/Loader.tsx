import type { ReactNode } from "react";

type LoaderProps = {
    className?: string;
};

export default function Loader({ className = "" }: LoaderProps) {
    return (
        <>
            <span
                aria-hidden="true"
                data-ui="loader"
                className={`block h-8 w-8 shrink-0 rounded-full border-4 ${className}`}
                style={{
                    animation: "imenu-loader-spin 800ms linear infinite",
                    background: "transparent",
                    borderColor: "#e5e7eb",
                    borderTopColor: "#9ca3af",
                }}
            />
            <style>{`
                @keyframes imenu-loader-spin {
                    to { rotate: 1turn; }
                }
            `}</style>
        </>
    );
}

export function PageLoader({ label = "Carregando" }: { label?: string; children?: ReactNode }) {
    return (
        <div data-ui="page-loader" role="status" aria-label={label} className="flex min-h-48 w-full flex-col items-center justify-center">
            <Loader />
        </div>
    );
}

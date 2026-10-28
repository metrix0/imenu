type LoaderProps = {
    className?: string;
};

export default function Loader({ className = "" }: LoaderProps) {
    return (
        <>
            <div
                className={`w-8 h-8 border-4 border-[var(--im-menu-border,#e5e7eb)] border-t-[var(--im-menu-subtle,#9ca3af)] rounded-full ${className}`}
                style={{
                    animation: "imenu-loader-spin 800ms linear infinite",
                    background: "transparent",
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

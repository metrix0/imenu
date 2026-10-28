export default function ListLoader({ lines = 3 }: { lines?: number }) {
    return (
        <div className="space-y-3 2xl:space-y-4">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="relative h-6 2xl:h-8 rounded bg-[var(--im-menu-raised,#e5e7eb)] overflow-hidden"
                >
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] ease-linear bg-gradient-to-r from-transparent via-[var(--im-menu-shimmer,rgba(255,255,255,0.6))] to-transparent" />
                </div>
            ))}
        </div>
    );
}

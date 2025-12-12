export default function ListLoader({ lines = 3 }: { lines?: number }) {
    return (
        <div className="space-y-3 2xl:space-y-4">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="relative h-6 2xl:h-8 rounded bg-gray-200 overflow-hidden"
                >
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] ease-linear bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
            ))}
        </div>
    );
}

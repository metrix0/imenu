interface BonusButtonProps {
    children: React.ReactNode;
    shimmer?: boolean;
    color?: string;
}

export default function BonusButton({
                                        children,
                                        shimmer = true,
                                        color = "bg-green",
                                    }: BonusButtonProps) {
    return (
        <button className="bg-text text-white px-3 py-1 rounded-full text-sm font-medium cursor-pointer relative overflow-hidden flex items-center gap-2">
            {/* Colored circle */}
            <span className={`w-3 h-3 rounded-full ${color}`} />

            {/* Shimmer */}
            {shimmer && (
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] ease-linear bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            )}

            {children}
        </button>
    );
}

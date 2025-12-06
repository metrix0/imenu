interface BonusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    shimmer?: boolean;
    color?: string;
}

export default function BonusButton({
                                        children,
                                        shimmer = true,
                                        color = "bg-green",
                                        className,
                                        ...props
                                    }: BonusButtonProps) {
    return (
        <button
            className={`bg-text text-white px-3 py-1 2xl:px-4 2xl:py-[6px]  rounded-full text-sm 2xl:text-[1.1rem] font-medium cursor-pointer relative overflow-hidden flex items-center gap-2 2xl:gap-3 ${className ?? ""}`}
            {...props}
        >
            {/* Colored circle */}
            <span className={`w-3 h-3 2xl:w-4 2xl:h-4 rounded-full ${color}`} />

            {/* Shimmer */}
            {shimmer && (
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] ease-linear bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            )}

            {children}
        </button>
    );
}

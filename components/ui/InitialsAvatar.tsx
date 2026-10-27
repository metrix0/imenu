type InitialsAvatarProps = {
    name: string | null | undefined;
    colorKey?: string | null;
    size?: "sm" | "lg";
};

const palette = [
    "bg-orange-100 text-orange-800",
    "bg-blue-100 text-blue-800",
    "bg-emerald-100 text-emerald-800",
    "bg-rose-100 text-rose-800",
    "bg-amber-100 text-amber-800",
    "bg-sky-100 text-sky-800",
];

export default function InitialsAvatar({
    name,
    colorKey,
    size = "sm",
}: InitialsAvatarProps) {
    const words = (name || "").trim().split(/\s+/).filter(Boolean);
    const initials = words.length
        ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toLocaleUpperCase("pt-BR")
        : "?";
    const key = colorKey || name || "";
    const colorIndex = Array.from(key).reduce((hash, char) => hash + char.charCodeAt(0), 0) % palette.length;

    return (
        <span
            aria-hidden="true"
            className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${size === "lg" ? "size-12 text-lg" : "size-9 text-sm"} ${palette[colorIndex]}`}
        >
            {initials}
        </span>
    );
}

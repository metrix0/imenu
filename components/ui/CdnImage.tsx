import Image, { type ImageProps } from "next/image";

const PUBLIC_STORAGE_PREFIX =
    "https://mjogdsnxbwhbqcoijrwt.supabase.co/storage/v1/object/public/";
const CDN_STORAGE_PREFIX = "/cdn/storage/";

export default function CdnImage({ src, unoptimized, ...props }: ImageProps) {
    const isPublicStorageImage =
        typeof src === "string" && src.startsWith(PUBLIC_STORAGE_PREFIX);
    const imageSrc = isPublicStorageImage
        ? CDN_STORAGE_PREFIX + src.slice(PUBLIC_STORAGE_PREFIX.length)
        : src;

    return (
        <Image
            {...props}
            src={imageSrc}
            unoptimized={
                unoptimized ||
                isPublicStorageImage ||
                (typeof src === "string" && src.startsWith(CDN_STORAGE_PREFIX))
            }
        />
    );
}

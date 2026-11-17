import { supabase } from "@/lib/database/supabaseClient";
import { menuPhotoPdfParts } from "@/lib/menu/menuPhotoPdf";

function concatBytes(parts: Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    parts.forEach((part) => {
        output.set(part, offset);
        offset += part.length;
    });

    return output;
}

function textBytes(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

async function imageFileToPdf(file: File): Promise<File> {
    const imageUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
            element.src = imageUrl;
        });

        if (!image.naturalWidth || !image.naturalHeight) {
            throw new Error("A imagem enviada possui dimensões inválidas.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Não foi possível preparar a imagem para análise.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        const jpegBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) =>
                    blob
                        ? resolve(blob)
                        : reject(
                              new Error(
                                  "Não foi possível preparar a imagem para análise."
                              )
                          ),
                "image/jpeg",
                1
            );
        });

        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const { before, after } = menuPhotoPdfParts(image.naturalWidth, image.naturalHeight, jpegBytes.length);
        const pdfBytes = concatBytes([textBytes(before), jpegBytes, textBytes(after)]);
        const baseName = file.name.replace(/\.[^.]+$/, "") || "cardapio";

        return new File([pdfBytes.buffer as ArrayBuffer], `${baseName}.pdf`, {
            type: "application/pdf",
            lastModified: file.lastModified,
        });
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

export async function uploadFullMenuImageAI(
    file: File,
    returnUrl: boolean = false
): Promise<string> {
    const uploadFile = file.type.startsWith("image/")
        ? await imageFileToPdf(file)
        : file;
    const key = `${crypto.randomUUID()}-${uploadFile.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;

    const { data, error } = await supabase.storage
        .from("full-menu-images-ai")
        .upload(key, uploadFile, { upsert: false });

    if (error) throw error;

    if (!returnUrl) {
        return key; // just return the storage key
    }

    // Generate public URL from key
    const { data: urlData } = supabase.storage
        .from("full-menu-images-ai")
        .getPublicUrl(key);

    return urlData.publicUrl;
}

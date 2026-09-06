import { supabase } from "@/lib/database/supabaseClient";

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
        const scale = 1000 / Math.max(image.naturalWidth, image.naturalHeight);
        const pageWidth = Math.max(1, image.naturalWidth * scale).toFixed(3);
        const pageHeight = Math.max(1, image.naturalHeight * scale).toFixed(3);
        const contentStream = textBytes(
            `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`
        );

        const objects = [
            textBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
            textBytes(
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            ),
            textBytes(
                `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
            ),
            concatBytes([
                textBytes(
                    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.naturalWidth} /Height ${image.naturalHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
                ),
                jpegBytes,
                textBytes("\nendstream\nendobj\n"),
            ]),
            concatBytes([
                textBytes(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`),
                contentStream,
                textBytes("endstream\nendobj\n"),
            ]),
        ];

        const header = textBytes("%PDF-1.4\n");
        const offsets: number[] = [];
        let currentOffset = header.length;

        objects.forEach((object) => {
            offsets.push(currentOffset);
            currentOffset += object.length;
        });

        const xrefOffset = currentOffset;
        const xref = textBytes(
            `xref\n0 6\n0000000000 65535 f \n${offsets
                .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
                .join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
        );
        const pdfBytes = concatBytes([header, ...objects, xref]);
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
    const key = `${crypto.randomUUID()}-${uploadFile.name}`;

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

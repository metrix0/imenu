export type ImageCompressionOptions = {
    maxWidth: number;
    maxHeight: number;
    targetBytes: number;
    initialQuality?: number;
    minQuality?: number;
    outputType?: "image/webp" | "image/jpeg";
};

type LoadedImage = {
    source: CanvasImageSource;
    width: number;
    height: number;
    cleanup: () => void;
};

async function loadImage(file: File): Promise<LoadedImage> {
    if (!file.type.startsWith("image/")) {
        throw new Error("O arquivo selecionado não é uma imagem válida.");
    }

    if (typeof createImageBitmap === "function") {
        try {
            const bitmap = await createImageBitmap(file);
            return {
                source: bitmap,
                width: bitmap.width,
                height: bitmap.height,
                cleanup: () => bitmap.close(),
            };
        } catch {
            // Fallback abaixo para navegadores/formats que não suportem createImageBitmap.
        }
    }

    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            resolve({
                source: image,
                width: image.naturalWidth,
                height: image.naturalHeight,
                cleanup: () => URL.revokeObjectURL(objectUrl),
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Não foi possível processar esta imagem."));
        };

        image.src = objectUrl;
    });
}

function encodeCanvas(
    canvas: HTMLCanvasElement,
    type: "image/webp" | "image/jpeg",
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Falha ao comprimir a imagem."));
                    return;
                }

                resolve(blob);
            },
            type,
            quality
        );
    });
}

function drawImage(
    source: CanvasImageSource,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Seu navegador não conseguiu processar a imagem.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);

    return canvas;
}

function outputExtension(type: string): string {
    if (type === "image/jpeg") return "jpg";
    return "webp";
}

function safeBaseName(filename: string): string {
    const withoutExtension = filename.replace(/\.[^/.]+$/, "");
    const sanitized = withoutExtension
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

    return sanitized || "imagem";
}

export async function compressImageForUpload(
    file: File,
    options: ImageCompressionOptions
): Promise<File> {
    const {
        maxWidth,
        maxHeight,
        targetBytes,
        initialQuality = 0.84,
        minQuality = 0.56,
        outputType = "image/webp",
    } = options;

    const loaded = await loadImage(file);

    try {
        if (loaded.width <= 0 || loaded.height <= 0) {
            throw new Error("A imagem possui dimensões inválidas.");
        }

        const initialScale = Math.min(
            1,
            maxWidth / loaded.width,
            maxHeight / loaded.height
        );

        let width = Math.max(1, Math.round(loaded.width * initialScale));
        let height = Math.max(1, Math.round(loaded.height * initialScale));

        if (
            file.type === outputType &&
            file.size <= targetBytes &&
            initialScale === 1
        ) {
            return file;
        }

        let bestBlob: Blob | null = null;

        // Primeiro reduz qualidade; se ainda necessário, reduz as dimensões
        // progressivamente. Isso evita uploads de vários megabytes sem
        // destruir a qualidade visual.
        for (let resizePass = 0; resizePass < 6; resizePass += 1) {
            const canvas = drawImage(loaded.source, width, height);
            let quality = initialQuality;

            while (quality >= minQuality - 0.001) {
                const blob = await encodeCanvas(canvas, outputType, quality);
                bestBlob = blob;

                if (blob.size <= targetBytes) {
                    break;
                }

                quality = Number((quality - 0.07).toFixed(2));
            }

            if (bestBlob && bestBlob.size <= targetBytes) {
                break;
            }

            if (width <= 320 || height <= 180) {
                break;
            }

            width = Math.max(320, Math.round(width * 0.84));
            height = Math.max(180, Math.round(height * 0.84));
        }

        if (!bestBlob) {
            throw new Error("Falha ao gerar a imagem otimizada.");
        }

        const extension = outputExtension(bestBlob.type || outputType);
        const optimizedName = `${safeBaseName(file.name)}.${extension}`;

        return new File([bestBlob], optimizedName, {
            type: bestBlob.type || outputType,
            lastModified: Date.now(),
        });
    } finally {
        loaded.cleanup();
    }
}

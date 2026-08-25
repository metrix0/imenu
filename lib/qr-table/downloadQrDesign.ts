type DownloadQrDesignOptions = {
    qrValue: string;
    displayUrl: string;
    title: string;
    bannerUrl: string;
    fileName: string;
};

const FONT_FAMILY = '"Inter", "Segoe UI", Arial, sans-serif';

function loadImage(url: string): Promise<HTMLImageElement> {
    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Não foi possível carregar a imagem.");
            }
            return response.blob();
        })
        .then(
            (blob) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const objectUrl = URL.createObjectURL(blob);
                    const image = new Image();
                    image.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve(image);
                    };
                    image.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(
                            new Error("Não foi possível carregar a imagem.")
                        );
                    };
                    image.src = objectUrl;
                })
        );
}

function drawCoverImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    const scale = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;

    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height
    );
}

function fitTextSize(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    weight = 800
): number {
    let size = maxSize;
    while (size > minSize) {
        context.font = `${weight} ${size}px ${FONT_FAMILY}`;
        if (context.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    return size;
}

export async function downloadQrDesign({
    qrValue,
    displayUrl,
    title,
    bannerUrl,
    fileName,
}: DownloadQrDesignOptions): Promise<void> {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=${encodeURIComponent(
        qrValue
    )}`;
    const [banner, qrCode] = await Promise.all([
        loadImage(bannerUrl),
        loadImage(qrUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível criar o QR Code.");

    const cleanDisplayUrl = displayUrl
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawCoverImage(context, banner, 0, 0, canvas.width, 390);

    context.textAlign = "center";
    context.textBaseline = "alphabetic";

    context.fillStyle = "#6b7280";
    context.font = `600 32px ${FONT_FAMILY}`;
    context.fillText("Abrir cardápio", 540, 500);

    context.fillStyle = "#111827";
    const titleFontSize = fitTextSize(context, title, 900, 94, 52, 800);
    context.font = `800 ${titleFontSize}px ${FONT_FAMILY}`;
    context.fillText(title, 540, 610, 900);

    context.drawImage(qrCode, 215, 685, 650, 650);

    context.fillStyle = "#6b7280";
    context.font = `500 28px ${FONT_FAMILY}`;
    context.fillText("Ou acesse pelo link", 540, 1430);

    context.fillStyle = "#f14400";
    const urlFontSize = fitTextSize(
        context,
        cleanDisplayUrl,
        900,
        34,
        22,
        700
    );
    context.font = `700 ${urlFontSize}px ${FONT_FAMILY}`;
    context.fillText(cleanDisplayUrl, 540, 1492, 900);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error("Não foi possível gerar o arquivo."));
        }, "image/png");
    });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
}

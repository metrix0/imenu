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
    const showTitleBadge =
        title.trim() !== "" && title.trim().toLowerCase() !== "universal";

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width, 390);
    context.clip();
    context.filter = "blur(12px)";
    drawCoverImage(context, banner, -24, -24, canvas.width + 48, 438);
    context.restore();

    context.fillStyle = "rgba(0, 0, 0, 0.20)";
    context.fillRect(0, 0, canvas.width, 390);

    context.textAlign = "center";
    context.textBaseline = "middle";

    if (showTitleBadge) {
        const badgeFontSize = fitTextSize(context, title, 820, 104, 54, 800);
        context.font = `800 ${badgeFontSize}px ${FONT_FAMILY}`;
        const badgeTextWidth = context.measureText(title).width;
        const badgeWidth = Math.min(940, Math.max(360, badgeTextWidth + 140));
        const badgeHeight = 150;
        const badgeX = (canvas.width - badgeWidth) / 2;
        const badgeY = 120;

        context.save();
        context.shadowColor = "rgba(17, 24, 39, 0.20)";
        context.shadowBlur = 28;
        context.shadowOffsetY = 10;
        context.fillStyle = "rgba(255, 255, 255, 0.94)";
        context.beginPath();
        context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 75);
        context.fill();
        context.restore();

        context.fillStyle = "#111827";
        context.fillText(title, 540, badgeY + badgeHeight / 2, badgeWidth - 80);
    }

    context.textBaseline = "alphabetic";
    context.fillStyle = "#111827";
    context.font = `800 82px ${FONT_FAMILY}`;
    context.fillText("Abrir cardápio", 540, 530, 900);

    context.drawImage(qrCode, 215, 610, 650, 650);

    context.fillStyle = "#6b7280";
    context.font = `500 28px ${FONT_FAMILY}`;
    context.fillText("Ou acesse pelo link", 540, 1370);

    const urlFontSize = fitTextSize(
        context,
        cleanDisplayUrl,
        790,
        30,
        20,
        700
    );
    context.font = `700 ${urlFontSize}px ${FONT_FAMILY}`;
    const urlTextWidth = context.measureText(cleanDisplayUrl).width;
    const urlBadgeWidth = Math.min(900, Math.max(360, urlTextWidth + 90));
    const urlBadgeHeight = 78;
    const urlBadgeX = (canvas.width - urlBadgeWidth) / 2;
    const urlBadgeY = 1408;

    context.fillStyle = "#f3f4f6";
    context.beginPath();
    context.roundRect(
        urlBadgeX,
        urlBadgeY,
        urlBadgeWidth,
        urlBadgeHeight,
        39
    );
    context.fill();

    context.fillStyle = "#111827";
    context.textBaseline = "middle";
    context.fillText(
        cleanDisplayUrl,
        540,
        urlBadgeY + urlBadgeHeight / 2,
        urlBadgeWidth - 60
    );

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

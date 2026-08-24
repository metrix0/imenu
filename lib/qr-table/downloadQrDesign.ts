type DownloadQrDesignOptions = {
    qrValue: string;
    displayUrl: string;
    title: string;
    bannerUrl: string;
    fileName: string;
};

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

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.beginPath();
    context.roundRect(70, 70, 940, 430, 32);
    context.clip();
    drawCoverImage(context, banner, 70, 70, 940, 430);
    context.restore();

    context.fillStyle = "#111827";
    context.font = "700 54px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(title, 540, 600, 900);

    context.fillStyle = "#ffffff";
    context.strokeStyle = "#e5e7eb";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(180, 660, 720, 720, 28);
    context.fill();
    context.stroke();
    context.drawImage(qrCode, 220, 700, 640, 640);

    context.fillStyle = "#f14400";
    context.font = "700 34px Arial, sans-serif";
    context.fillText(displayUrl, 540, 1485, 920);

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

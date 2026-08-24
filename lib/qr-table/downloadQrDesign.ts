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

    const cleanDisplayUrl = displayUrl
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
    const background = context.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, "#fff4ee");
    background.addColorStop(0.45, "#ffffff");
    background.addColorStop(1, "#fffaf7");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.beginPath();
    context.roundRect(70, 70, 940, 390, 32);
    context.clip();
    drawCoverImage(context, banner, 70, 70, 940, 390);
    context.restore();

    context.fillStyle = "#111827";
    context.font = "700 58px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(title, 540, 560, 900);

    context.fillStyle = "#f14400";
    context.beginPath();
    context.roundRect(450, 590, 180, 8, 4);
    context.fill();

    context.fillStyle = "rgba(17, 24, 39, 0.10)";
    context.beginPath();
    context.roundRect(170, 638, 740, 740, 32);
    context.fill();

    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffd8c7";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(170, 625, 740, 740, 32);
    context.fill();
    context.stroke();
    context.drawImage(qrCode, 220, 675, 640, 640);

    context.fillStyle = "#f14400";
    context.beginPath();
    context.roundRect(100, 1430, 880, 92, 46);
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = "700 32px Arial, sans-serif";
    context.fillText(cleanDisplayUrl, 540, 1489, 800);

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

const NTFY_BASE_URL = "https://ntfy.sh";

export async function sendNtfyNotification(input: {
    message: string;
    title?: string;
}): Promise<void> {
    const topic = process.env.NTFY_TOPIC?.trim();
    if (!topic) {
        throw new Error("NTFY_TOPIC não configurado.");
    }

    const message = input.message.trim();
    const title = input.title?.trim();

    if (!message) {
        throw new Error("Mensagem de notificação vazia.");
    }

    const response = await fetch(
        `${NTFY_BASE_URL}/${encodeURIComponent(topic)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                ...(title ? { Title: title.slice(0, 200) } : {}),
            },
            body: message.slice(0, 4000),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(`ntfy HTTP ${response.status}`);
    }
}

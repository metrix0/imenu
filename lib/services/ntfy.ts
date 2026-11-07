import { recordDevAlert, type AlertTrigger } from "@/lib/dev/health";

export async function sendNtfyNotification(input: {
    source: string;
    message: string;
    title?: string;
    severity?: string;
    trigger?: AlertTrigger;
    operation?: string;
    httpStatus?: number | null;
    incidentKey?: string;
}): Promise<void> {
    if (!input.message.trim()) throw new Error("Mensagem de notificação vazia.");
    const result = await recordDevAlert({
        ...input,
        title: input.title?.trim() || "iMenu",
        message: input.message.trim(),
        severity: input.severity || (/ALARM TRIGGER|TRIGGER ALARM/.test(input.title || "") ? "critical" : "notification"),
        notification: true,
    });
    if (result?.deliveryError) throw new Error(result.deliveryError);
}

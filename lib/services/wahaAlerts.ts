export const SUPPORT_WAHA_SESSION_NAME = "imenu-support";
export const BLAST_WAHA_SESSION_NAME = "imenu-blast";

export const OFFICIAL_WAHA_SESSIONS = [SUPPORT_WAHA_SESSION_NAME, BLAST_WAHA_SESSION_NAME] as const;
type Failure = "connection" | "inbound" | "outbound";

function incidentKey(session: string, failure: Failure): string {
    return failure === "connection" ? `waha:session:${session}` : `waha:${failure}:${session}`;
}

export async function reportOfficialWahaFailure(session: string, failure: Failure, message: string) {
    const label = session === SUPPORT_WAHA_SESSION_NAME ? "Suporte" : session === BLAST_WAHA_SESSION_NAME ? "Blast" : null;
    if (!label) return;
    const { recordDevAlert } = await import("@/lib/dev/health");
    const operation = { connection: "Conexão", inbound: "Recebimento", outbound: "Envio" }[failure];
    return recordDevAlert({
        source: "waha",
        severity: "critical",
        trigger: "alarm",
        title: `ALARM TRIGGER · WhatsApp ${label}: falha de ${operation.toLowerCase()}`,
        message,
        operation: `${operation} WhatsApp ${label}`,
        incidentKey: incidentKey(session, failure),
    });
}

export async function resolveOfficialWahaFailure(session: string, failure: Failure) {
    if (session !== SUPPORT_WAHA_SESSION_NAME && session !== BLAST_WAHA_SESSION_NAME) return;
    const { resolveDevIncident } = await import("@/lib/dev/health");
    return resolveDevIncident(incidentKey(session, failure));
}

export async function reportWahaClientOutdated() {
    const { recordDevAlert } = await import("@/lib/dev/health");
    return recordDevAlert({
        source: "waha",
        severity: "critical",
        trigger: "alarm",
        title: "ALARM TRIGGER · Cliente WAHA desatualizado",
        message: "O WhatsApp rejeitou a versão do cliente do WAHA (405 Client outdated). Confira a versão e a reconexão das sessões.",
        operation: "Compatibilidade WAHA",
        incidentKey: `waha:client-outdated:${new Date().toISOString().slice(0, 10)}`,
        httpStatus: 405,
    });
}

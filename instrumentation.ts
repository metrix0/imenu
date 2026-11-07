export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { installIntegrationObserver } = await import("@/lib/dev/health");
        installIntegrationObserver();
    }
}

export const onRequestError = async (_error: unknown, _request: unknown, context: { routePath: string }) => {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { recordDevAlert } = await import("@/lib/dev/health");
        await recordDevAlert({ source: context.routePath || "application", title: "Falha na aplicação", message: `Rota: ${context.routePath}` });
    }
};

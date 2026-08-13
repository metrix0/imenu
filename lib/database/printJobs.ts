type TransactionClient = {
    query: (text: string, values?: unknown[]) => Promise<unknown>;
};

export async function suppressQueuedPrintJob(
    client: TransactionClient,
    orderId: string,
): Promise<void> {
    await client.query(
        `
            UPDATE print_jobs
            SET status = 'canceled'
            WHERE order_id = $1
              AND status = 'queued'
        `,
        [orderId],
    );
}

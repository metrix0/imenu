import OrderPushTrigger from "@/components/costumer/OrderPushTrigger";

export default async function OrderLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string; id: string }>;
}) {
    const { id } = await params;

    return (
        <>
            <OrderPushTrigger orderId={id} />
            {children}
        </>
    );
}

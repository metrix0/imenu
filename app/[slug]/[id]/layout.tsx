import OrderPushTrigger from "@/components/costumer/OrderPushTrigger";
import PostPaymentWhatsappPrompt from "@/components/costumer/PostPaymentWhatsappPrompt";

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
            <PostPaymentWhatsappPrompt orderId={id} />
            {children}
        </>
    );
}

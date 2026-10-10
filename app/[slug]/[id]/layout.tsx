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
            <PostPaymentWhatsappPrompt orderId={id} />
            {children}
        </>
    );
}

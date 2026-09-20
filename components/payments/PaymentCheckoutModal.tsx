"use client";

import PaymentCheckout, {
    type PaymentCheckoutProps,
} from "@/components/payments/PaymentCheckout";
import Modal from "@/components/ui/Modal";

type PaymentCheckoutModalProps = PaymentCheckoutProps & {
    open: boolean;
    height?: number;
    className?: string;
    showCloseButton?: boolean;
};

export default function PaymentCheckoutModal({
    open,
    height = 760,
    className = "max-w-4xl",
    showCloseButton = true,
    onClose,
    ...checkoutProps
}: PaymentCheckoutModalProps) {
    return (
        <Modal
            height={height}
            open={open}
            onClose={onClose}
            className={className}
            showCloseButton={showCloseButton}
        >
            <PaymentCheckout {...checkoutProps} onClose={onClose} />
        </Modal>
    );
}

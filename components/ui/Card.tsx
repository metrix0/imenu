import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", ...props }: CardProps) {
    const isOrderCard = className.split(/\s+/).includes("panel-order");

    return (
        <div
            data-ui="card"
            className={`rounded-[10px] border border-[#e2e5e9] bg-white p-5 ${isOrderCard ? "shadow-none" : "shadow-[0_0_0_1px_#e2e5e9]"} ${className}`}
            {...props}
        />
    );
}

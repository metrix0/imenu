import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", ...props }: CardProps) {
    return (
        <div
            data-ui="card"
            className={`rounded-[10px] border border-[#e2e5e9] bg-white p-5 shadow-[0_0_0_1px_#e2e5e9] ${className}`}
            {...props}
        />
    );
}

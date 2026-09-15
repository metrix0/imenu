import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", ...props }: CardProps) {
    return (
        <div
            data-ui="card"
            className={`rounded-[10px] border border-[#e2e5e9] bg-white p-5 shadow-none ${className}`}
            {...props}
        />
    );
}

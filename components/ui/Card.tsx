import * as React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", ...props }: CardProps) {
    return (
        <div
            className={`bg-white rounded-lg shadow-md p-5 2xl:p-8 2xl:pt-6  ${className}`}
            {...props}
        />
    );
}

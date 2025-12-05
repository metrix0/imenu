import React from "react";

export default async function Page() {
    const res = await fetch("http://localhost:3000/api/scan-menu", {
        method: "POST",
        body: JSON.stringify({
            restaurantId: "0997e978-7f1e-46a9-88f7-81813c519485",
            urls: [
                "https://mjogdsnxbwhbqcoijrwt.supabase.co/storage/v1/object/public/full-menu-images-ai/1131w-jTdd2QRAuAs.webp"
            ]
        }),
        headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();

    return (
        <div>
            <h1>Menu Scan Result</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
}
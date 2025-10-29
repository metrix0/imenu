"use client";
import { useState } from "react";
import { uploadMenuImage } from "@/lib/uploadMenuImage";

export default function TestUpload() {
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState("");

    async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setMessage("Uploading...");
            const key = await uploadMenuImage(file);
            setMessage(`Uploaded: ${key}`);
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${key}`;
            setPreview(url);
        } catch (err: any) {
            setMessage(`Error: ${err.message}`);
        }
    }

    return (
        <main className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Upload Test</h1>
            <input type="file" accept="image/*" onChange={handleChange} />
            <p>{message}</p>
            {preview && <img src={preview} alt="Preview" className="w-64 rounded" />}
        </main>
    );
}

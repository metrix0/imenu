"use client";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { icons } from "@/lib/fontawesome";
import Popup from "@/components/Popup";
import Toast from "@/components/Toast";

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const router = useRouter();
    const [showPopup, setShowPopup] = useState(false);
    const [showToast, setShowToast] = useState(false);
    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErr(error.message);
        else router.replace("/admin");
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <img src="https://mjogdsnxbwhbqcoijrwt.supabase.co/storage/v1/object/public/menu-images/menu-images/download%20(4).png" alt="Product" />


            <button onClick={() => setShowToast(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md">Botão Toast</button>

            {showToast && (<Toast message="Alterações salvas com sucesso!"  type="success" onClose={() => setShowToast(false)}/>)}
            <Popup open={showPopup} onClose={() => setShowPopup(false)}>
            </Popup>
            <button onClick={() => setShowPopup(true)} className="px-4 py-2 bg-green-600 text-white rounded-md">Botão Popup</button>

            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
                <h1 className="text-2xl font-bold">Admin <FontAwesomeIcon icon={icons.faPlus} className="text-green-600" /></h1>
                {err && <p className="text-red-600">{err}</p>}
                <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
                <input className="border p-2 w-full" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                <button className="bg-black text-white px-4 py-2 rounded">Entrar</button>
            </form>
        </main>
    );
}

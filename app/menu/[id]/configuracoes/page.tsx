// app/menu/[id]/configuracoes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient"; 
import type { User } from "@supabase/supabase-js";


type Restaurant = {

    id: string;
    name: string;
    url_slug: string; 
};



const loadScript = (src: string, onLoad: () => void) => {
   
    if (document.querySelector(`script[src="${src}"]`)) {

        onLoad();
        return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = onLoad;

    document.head.appendChild(script);
};

export default function MenuSettingsPage() {

    const router = useRouter();
    const params = useParams();
    
    const slugFromParams = Array.isArray(params.id) ? params.id[0] : params.id;


    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    const [loading, setLoading] = useState(true); 
    const [isDeleting, setIsDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', content: string } | null>(null);


    const [shareableUrl, setShareableUrl] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState(""); 
    const [copySuccess, setCopySuccess] = useState("");


    
    useEffect(() => {
        if (!slugFromParams) return; 


        setLoading(true);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(

            async (event, session) => {
                
                if (!session) {

                    setMessage({ type: 'error', content: "Sessão não encontrada. Faça login." });
                    setLoading(false); 
                    router.push("/admin/login");

                    return; 
                }

                setUser(session.user);


                const { data, error } = await supabase
                    .from("restaurants")
                    .select("id, name, url_slug")

                    .eq("url_slug", slugFromParams) 
                    .eq("user_id", session.user.id) 
                    .single();


                if (error || !data) {
                    setMessage({ type: 'error', content: "Restaurante não encontrado ou você não tem permissão." });
                    setRestaurant(null);

                    setLoading(false);
                } else {
                    setRestaurant(data);
                    

                    const url = `${window.location.origin}/menu/${data.url_slug}`; 
                    setShareableUrl(url);

        
                    loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js", () => {
                     

                        if (window.QRCode) {
                            window.QRCode.toDataURL(url, { width: 200, margin: 1 }, (err: any, dataUrl: string) => {
                                if (err) {

                                    console.error("Erro ao gerar QR Code:", err);
                                    return;
                                }

                                
                                setQrCodeUrl(dataUrl); 
                            });

                        }
                    });
                    
                    setLoading(false); 

                }
            }
        );


        return () => subscription.unsubscribe();

    }, [slugFromParams, router]);




    const handleDeleteRestaurant = async () => {

        if (!restaurant) return;

        const confirmDelete = confirm(
            `Você tem CERTEZA que deseja deletar o restaurante "${restaurant.name}"?\nEsta ação é irreversível.`

        );

        if (!confirmDelete) return;

        setIsDeleting(true);

        setMessage(null);

        const { error } = await supabase
            .from("restaurants")

            .delete()
            .eq("id", restaurant.id); 

        if (error) {

            setMessage({ type: 'error', content: `Erro ao deletar: ${error.message}` });
            setIsDeleting(false);
        } else {
            setMessage({ type: 'success', content: "Restaurante deletado com sucesso." });

            router.push("/restaurante/criar"); 
        }
    };


    const handleCopyLink = () => {
        if (!shareableUrl) return;
        const tempInput = document.createElement('input');

        document.body.appendChild(tempInput);
        tempInput.value = shareableUrl;
        tempInput.select();

        try {
            document.execCommand('copy');
            setCopySuccess('Link copiado!');

            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('Falha ao copiar.');

        }
        document.body.removeChild(tempInput);
    };

  

    const handleDownloadQR = () => {
        

        if (!qrCodeUrl || !restaurant) return;
        
       
        const link = document.createElement('a');

        link.href = qrCodeUrl; 
        link.download = `${restaurant.url_slug}-qrcode.png`; 
        document.body.appendChild(link);

        link.click();
        document.body.removeChild(link);
    };



    if (loading) {

        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <p className="text-gray-600 text-lg">Carregando configurações...</p>

            </div>
        );
    }

    if (!restaurant) {

        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <p className="text-red-600 text-lg">{message?.content || "Restaurante não encontrado."}</p>
                <button

                    onClick={() => router.push("/restaurante/criar")}

                    className="mt-3 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                    Criar novo restaurante

                </button>
            </div>
        );
    }

    return (

        <div className="flex min-h-screen flex-col items-center bg-gray-50 p-6">
            <div className="w-full max-w-2xl space-y-8">
                <div className="text-center">

                    <h1 className="text-3xl font-bold text-gray-900">
                        Configurações
                    </h1>
                    <p className="text-lg text-gray-600">

                        Gerenciando: <span className="font-semibold">{restaurant.name}</span>
                    </p>
                </div>


                {message && (
                    <div
                        className={`rounded-md p-3 text-sm font-medium ${

                            message.type === "success"
                                ? "bg-green-100 text-green-800 border border-green-300"
                                : "bg-red-100 text-red-800 border border-red-300"

                        }`}
                    >
                        {message.content}

                    </div>
                )}
                
                {/* Restaurant Profile */}

                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Perfil da Loja</h2>
                    <p className="text-sm text-gray-700">

                        Edite o nome, descrição e endereço do seu restaurante.
                    </p>
                    <button
                        disabled

                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        Editar Perfil (Em breve)

                    </button>
                </section>

                {/* Time */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="text-lg font-semibold text-gray-900">Horários</h2>
                    <p className="text-sm text-gray-700">
                        Defina quando sua loja está aberta para receber pedidos.

                    </p>
                    <button
                        disabled
                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"

                    >
                        Definir Horários (Em breve)
                    </button>

                </section>

                {/* Share Menu */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="text-lg font-semibold text-gray-900">Compartilhar Cardápio</h2>
                    <p className="text-sm text-gray-700">
                        Use o link direto ou o QR Code para seus clientes acessarem o cardápio.

                    </p>
                    
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input

                            type="text"
                            value={shareableUrl}
                            readOnly

                            className="flex-grow rounded-md border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <button

                            onClick={handleCopyLink}
                            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
                        >

                            {/* Ícone removido */}
                            {copySuccess ? copySuccess : "Copiar Link"}
                        </button>

                    </div>

                    <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-gray-50 p-6">
                        {qrCodeUrl ? (

                            <img
                                src={qrCodeUrl} // Agora é um Data URL
                                alt="QR Code do Cardápio"

                                width={200}
                                height={200}
                                className="rounded-md border border-gray-300"

                            />
                        ) : (
                            <div className="flex h-[200px] w-[200px] items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-sm text-gray-500">

                                Gerando QR Code...
                            </div>
                        )}
                        <button

                            onClick={handleDownloadQR}
                            className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            
                            Baixar QR Code
                        </button>

                    </div>
                </section>

                {/* Delete Account */}

                <section className="space-y-4 rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-red-800">Zona de Perigo</h2>
                    <p className="text-sm text-red-700">

                        Exclui seu restaurante e todos os seus dados permanentemente.
                        Isso inclui cardápios, pedidos e configurações.
                    </p>

                    <button
                        onClick={handleDeleteRestaurant}
                        disabled={isDeleting}

                        className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isDeleting ? "Deletando..." : "Deletar este Restaurante"}

                    </button>
                </section>
            </div>

        </div>
    );
}

// For Typescript to recognize 'window.QRCode'

declare global {
    interface Window {
        QRCode: {
            toDataURL: (text: string, options: { width: number, margin: number }, callback: (err: any, dataUrl: string) => void) => void;

        };
    }
}
// app/menu/[slug]/configuracoes/page.tsx
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

export default function MenuSettingsPage() {

    const router = useRouter();
    const params = useParams();
    

    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', content: string } | null>(null);

    // 1 Search user and restaurant data

    useEffect(() => {
        if (!slug) return;

        const fetchData = async () => {

            setLoading(true);
            
            // 1a. Search user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setMessage({ type: 'error', content: "Sessão não encontrada. Faça login." });
                setLoading(false);
                router.push("/admin/login");

                return;
            }
            setUser(user);

            // 1b. Search restaurant (garantees that the user is it owner)

            const { data, error } = await supabase
                .from("restaurants")
                .select("id, name, url_slug")
                .eq("url_slug", slug)
                .eq("user_id", user.id) // double verification

                .single();

            if (error || !data) {
                setMessage({ type: 'error', content: "Restaurante não encontrado ou você não tem permissão." });

            } else {
                setRestaurant(data);
            }
            setLoading(false);

        };

        fetchData();
    }, [slug, router]);

    // 2. Function to delete restaurant

    const handleDeleteRestaurant = async () => {
        if (!restaurant) return;

        const confirmDelete = confirm(

            `Você tem CERTEZA que deseja deletar o restaurante "${restaurant.name}"?\nEsta ação é irreversível.`
        );

        if (!confirmDelete) return;


        setIsDeleting(true);
        setMessage(null);

        // RLS (auth.uid() = user_id) in Supabase garantees that the user can deletes it's restaurant

        const { error } = await supabase
            .from("restaurants")
            .delete()

            .eq("id", restaurant.id);

        if (error) {
            setMessage({ type: 'error', content: `Erro ao deletar: ${error.message}` });

            setIsDeleting(false);
        } else {
            setMessage({ type: 'success', content: "Restaurante deletado com sucesso." });
            // Redirect to creation page
            router.push("/restaurante/criar"); 

        }
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

                {/* --- Outras Seções de Configuração (Exemplos) --- */}
                
                {/* Perfil da Loja */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="text-lg font-semibold text-gray-900">Perfil da Loja</h2>
                    <p className="text-sm text-gray-700">
                        Edite o nome, descrição e endereço do seu restaurante.
                    </p>

                    <button
                        // onClick={() => router.push(`/setup/perfil/${restaurant.url_slug}`)}
                        disabled // Desabilitado por enquanto
                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"

                    >
                        Editar Perfil (Em breve)
                    </button>
                </section>

                {/* Horários */}
                <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="text-lg font-semibold text-gray-900">Horários</h2>
                    <p className="text-sm text-gray-700">
                        Defina quando sua loja está aberta para receber pedidos.

                    </p>
                    <button
                        disabled // Desabilitado por enquanto
                        className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"

                    >
                        Definir Horários (Em breve)
                    </button>
                </section>


                {/* --- Seção de Deletar (Principal) --- */}
                <section className="space-y-4 rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">

                    <h2 className="text-lg font-semibold text-red-800">Deletar Restaurante</h2>
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


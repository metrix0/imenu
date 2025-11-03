// app/configuracoes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState("");
    
    const [message, setMessage] = useState<{ type: 'success' | 'error', content: string } | null>(null);

    // Fetch the current user on page load
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        };
        fetchUser();
    }, []);

    const handleUpdateEmail = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage(null);
        if (!user) return;

        // Define our custom callback URL
        const redirectTo = `${location.origin}/atualizando-email`;

        const { error } = await supabase.auth.updateUser(
            { email: newEmail }, 
            { emailRedirectTo: redirectTo });

        if (error) {
            setMessage({ type: 'error', content: `Error: ${error.message}` });
        } else {
            setNewEmail("");
            setMessage({ type: 'success', content: "Links de confirmação enviado para o e-mail antigo e novo. Por favor, verifique para completar a mudança." });
        }
    };

    
    const handleDeleteAccount = async () => {
        if (!confirm("Você tem certeza que deseja excluir sua conta?")) return;

        setMessage(null);

        try {
            const session = await supabase.auth.getSession();
            const access_token = session.data.session?.access_token;
            if (!access_token) throw new Error("No session");

            const response = await fetch("/api/auth/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                setMessage({ type: "error", content: data.error || "Falha ao excluir a conta." });
                return;
            }

            await supabase.auth.signOut();
            
            // sends user to:
            router.push("/admin/login"); 
            

        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", content: "Erro ao excluir a conta." });
        }
    };


    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login'); 
        router.refresh();
    };

if (loading) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p className="text-gray-600 text-lg">Carregando detalhes da conta...</p>
    </div>
  );
}

if (!user) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-gray-700 text-lg">Você não está conectado.</p>
      <button
        onClick={() => router.push("/admin/login")}
        className="mt-3 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Entrar
      </button>
    </div>
  );
}

return (
  <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
    <div className="w-full max-w-xl space-y-8 rounded-lg bg-white p-8 shadow-md">
      <h1 className="text-center text-3xl font-bold text-gray-900">
        Configurações da Conta
      </h1>
      <p className="text-center text-gray-600">Conectado como: {user.email}</p>

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

      {/* Change email */}
      <section className="space-y-4 rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Mudar E-mail</h2>
        <form
          onSubmit={handleUpdateEmail}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Novo e-mail"
            required
            className="flex-grow rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Atualizar E-mail
          </button>
        </form>
      </section>

      {/* Disconect */}
      <section className="space-y-4 rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Sair</h2>
        <p className="text-sm text-gray-700">
          Encerra a sessão atual neste dispositivo.
        </p>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
        >
          Sair
        </button>
      </section>

      {/* Delete Account */}
      <section className="space-y-4 rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-800">Excluir Conta</h2>
        <p className="text-sm text-red-700">
          Exclui sua conta e todos os seus dados permanentemente. Essa ação não
          pode ser desfeita.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Excluir Conta
        </button>
      </section>
    </div>
  </div>
);

}
// app/setup/perfil/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// === CAMINHO CORRIGIDO ===
// Usando o caminho relativo correto de app/setup/perfil para a raiz
import { supabase } from "../../../lib/supabaseClient";

/**
 * Helper function to create a URL-friendly "slug" from a string.
 */
const slugify = (text: string) => {

    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

/**
 * Helper function to format phone input as (XX) 9XXXX-XXXX
 */
const formatPhone = (value: string) => {

    // 1. Remove all non-numeric characters
    const digits = value.replace(/\D/g, '').slice(0, 11);

    // 2. Apply formatting
    let result = "";

    if (digits.length > 0) {
        result = `(${digits.slice(0, 2)}`;
    }
    if (digits.length > 2) {
        result += `) ${digits.slice(2, 7)}`;
    }

    if (digits.length > 7) {
        result += `-${digits.slice(7, 11)}`;
    }
    return result;
};

/**
 * Helper function to format input to only allow numbers
 */
const formatNumeric = (value: string) => {

    return value.replace(/\D/g, '');
};


const brazilianStates = [

    { uf: 'AC', nome: 'Acre' },
    { uf: 'AL', nome: 'Alagoas' },
    { uf: 'AP', nome: 'Amapá' },
    { uf: 'AM', nome: 'Amazonas' },
    { uf: 'BA', nome: 'Bahia' },
    { uf: 'CE', nome: 'Ceará' },
    { uf: 'DF', nome: 'Distrito Federal' },
    { uf: 'ES', nome: 'Espírito Santo' },
    { uf: 'GO', nome: 'Goiás' },
    { uf: 'MA', nome: 'Maranhão' },
    { uf: 'MT', nome: 'Mato Grosso' },
    { uf: 'MS', nome: 'Mato Grosso do Sul' },
    { uf: 'MG', nome: 'Minas Gerais' },
    { uf: 'PA', nome: 'Pará' },
    { uf: 'PB', nome: 'Paraíba' },
    { uf: 'PR', nome: 'Paraná' },
    { uf: 'PE', nome: 'Pernambuco' },
    { uf: 'PI', nome: 'Piauí' },
    { uf: 'RJ', nome: 'Rio de Janeiro' },
    { uf: 'RN', nome: 'Rio Grande do Norte' },
    { uf: 'RS', nome: 'Rio Grande do Sul' },
    { uf: 'RO', nome: 'Rondônia' },
    { uf: 'RR', nome: 'Roraima' },
    { uf: 'SC', nome: 'Santa Catarina' },
    { uf: 'SP', nome: 'São Paulo' },
    { uf: 'SE', nome: 'Sergipe' },
    { uf: 'TO', nome: 'Tocantins' }
];


export default function SetupPerfilPage() {

    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', content: string } | null>(null);

    // Estados do formulário (atualizados)
    const [name, setName] = useState("");

    const [description, setDescription] = useState("");
    const [phone, setPhone] = useState("");
    
    // Estados de endereço separados
    // const [cep, setCep] = useState(""); // Removido
    const [street, setStreet] = useState("");

    const [number, setNumber] = useState("");
    const [neighborhood, setNeighborhood] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState(""); // UF

    const handleCreateRestaurant = async (e: React.FormEvent<HTMLFormElement>) => {

        e.preventDefault();
        setLoading(true);
        setMessage(null);

        // 1. Get current logged-in user

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setMessage({ type: 'error', content: "Sessão expirada. Por favor, faça login novamente." });
            setLoading(false);

            return;
        }

        // 2. Generate slug
        const url_slug = slugify(name);

        if (!url_slug) {
            setMessage({ type: 'error', content: "Por favor, insira um nome válido." });
            setLoading(false);
            return;
        }

        // 3. Combine address fields into one string for the DB

        // Atualizado para remover o CEP
        const fullAddress = `${street}, ${number} - ${neighborhood}, ${city} - ${state}`;

        // 4. Insert into database
        const { data, error } = await supabase
            .from("restaurants")

            .insert({
                user_id: user.id, 
                name,
                url_slug,

                description,
                phone: phone.replace(/\D/g, ''), // Salva apenas os números
                address: fullAddress
            })

            .select()
            .single();

        if (error) {

            if (error.code === '23505') { 
                setMessage({ type: 'error', content: "Erro: Um restaurante com esse nome (e URL) já existe." });
            } else {
                setMessage({ type: 'error', content: `Erro ao criar: ${error.message}` });

            }
            setLoading(false);
        } else if (data) {

            // 5. Success: Redirect
            router.push(`/menu/${data.url_slug}/configuracoes`);
        }
    };

    return (

        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-2xl space-y-6 rounded-lg bg-white p-10 shadow-md">
                <h1 className="text-center text-3xl font-bold text-gray-900">
                    Perfil da Loja

                </h1>
                <p className="text-center text-gray-600">
                    Estas são as informações que seus clientes verão.
                </p>

                <form onSubmit={handleCreateRestaurant} className="space-y-5">
                    

                    <div>
                        <label htmlFor="name" className="block text-base font-medium text-gray-700">
                            Nome da Loja (Obrigatório)
                        </label>

                        <input
                            id="name" type="text"
                            value={name} 
                            onChange={(e) => setName(e.target.value)}

                            required
                            maxLength={80} // Limite de caracteres
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                    

                    <div>
                        <label htmlFor="description" className="block text-base font-medium text-gray-700">
                            Descrição da Loja
                        </label>

                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}

                            maxLength={400} // Limite de caracteres
                            rows={3}
                            placeholder="Uma breve descrição do seu restaurante (máx. 400 caracteres)"
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                    

                    <div>
                        <label htmlFor="phone" className="block text-base font-medium text-gray-700">
                            Telefone (Obrigatório)
                        </label>

                        <input
                            id="phone" type="tel"
                            value={phone} 
                            onChange={(e) => setPhone(formatPhone(e.target.value))} // Aplica máscara

                            required
                            placeholder="(XX) 9XXXX-XXXX"
                            maxLength={15} // (XX) 9XXXX-XXXX
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"

                        />
                    </div>

                    {/* --- Seção de Endereço Separada --- */}

                    <fieldset className="space-y-4 rounded-lg border border-gray-200 p-4">
                        <legend className="text-base font-medium text-gray-900">Endereço (Obrigatório)</legend>

                        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
                            
                            <div className="md:col-span-2">

                                <label htmlFor="street" className="block text-sm font-medium text-gray-700">Rua</label>
                                <input
                                    id="street" type="text"
                                    value={street}

                                    onChange={(e) => setStreet(e.target.value)}
                                    placeholder="Ex: Rua das Flores"
                                    required
                                    maxLength={150}

                                    className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>

                                <label htmlFor="number" className="block text-sm font-medium text-gray-700">Número</label>
                                <input
                                    id="number" type="text" // 'text' para permitir 'formatNumeric'
                                    value={number}

                                    onChange={(e) => setNumber(formatNumeric(e.target.value))} // Apenas números
                                    placeholder="123"
                                    required
                                    maxLength={10}

                                    className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            
                            <div className="md:col-span-3">

                                <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700">Bairro</label>
                                <input
                                    id="neighborhood" type="text"
                                    value={neighborhood}

                                    onChange={(e) => setNeighborhood(e.target.value)}
                                    placeholder="Ex: Centro"
                                    required
                                    maxLength={100}

                                    className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="md:col-span-2">

                                <label htmlFor="city" className="block text-sm font-medium text-gray-700">Cidade</label>
                                <input
                                    id="city" type="text"
                                    value={city}

                                    onChange={(e) => setCity(e.target.value)}
                                    required
                                    maxLength={100}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"

                                />
                            </div>

                            <div>

                                <label htmlFor="state" className="block text-sm font-medium text-gray-700">Estado (UF)</label>
                                <select
                                    id="state"
                                    value={state}

                                    onChange={(e) => setState(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >

                                    <option value="" disabled>Selecione...</option>
                                    {brazilianStates.map((s) => (
                                        <option key={s.uf} value={s.uf}>{s.nome} ({s.uf})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </fieldset>
                    {/* --- Fim da Seção de Endereço --- */}



                    {message && (
                        <div
                        className={`rounded-md p-3 text-sm font-medium ${
                            message.type === "success"

                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                        >

                        {message.content}
                        </div>
                    )}

                    <button

                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-60"
                    >

                        {loading ? "Salvando..." : "Salvar e Continuar"}
                    </button>
                </form>
            </div>
        </div>

    );
}

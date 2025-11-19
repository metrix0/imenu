"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import CreationStepper from "@/components/restaurante/configuracoes/CreationStepper";

type CepData = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    location?: {
        type: string;
        coordinates: {
            longitude: string;
            latitude: string;
        };
    };
};

export default function LocalizacaoPage() {
    const router = useRouter();
    const { restaurantId } = useCreationStore();

    // Form state
    const [cep, setCep] = useState("");
    const [estado, setEstado] = useState("");
    const [cidade, setCidade] = useState("");
    const [bairro, setBairro] = useState("");
    const [rua, setRua] = useState("");
    const [numero, setNumero] = useState("");
    const [complemento, setComplemento] = useState("");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
    const [error, setError] = useState("");
   
    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        setIsLoadingCep(true);
        setError("");

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
            if (!response.ok) throw new Error("CEP não encontrado.");

            const data: CepData = await response.json();

            setEstado(data.state);
            setCidade(data.city);
            setBairro(data.neighborhood);
            setRua(data.street);

            if (data.location?.coordinates?.latitude && data.location.coordinates.longitude) {
                setLatitude(parseFloat(data.location.coordinates.latitude));
                setLongitude(parseFloat(data.location.coordinates.longitude));
                setError("");
            } else {
                const fullAddress = `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}, Brasil`;
                const geoResponse = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`
                );
                const geoData = await geoResponse.json();

                if (geoData && geoData.length > 0) {
                    setLatitude(parseFloat(geoData[0].lat));
                    setLongitude(parseFloat(geoData[0].lon));
                    setError("");
                } else {
                    setLatitude(null);
                    setLongitude(null);
                    setError("Não foi possível encontrar as coordenadas geográficas. Tente um CEP próximo.");
                }
            }
        } catch (err) {
            console.error(err);
            setError((err as Error).message || "Erro ao buscar CEP.");
            setLatitude(null);
            setLongitude(null);
        } finally {
            setIsLoadingCep(false);
        }
    };


    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocalização não é suportada por este navegador.");
            return;
        }

        setIsLoadingCep(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setLatitude(latitude);
                setLongitude(longitude);

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
                    );

                    if (!response.ok) {
                        throw new Error("Não foi possível obter o endereço a partir da localização.");
                    }

                    const data = await response.json();
                    const addr = data.address || {};

                    setRua(addr.road || "");
                    setBairro(addr.suburb || addr.neighbourhood || "");
                    setCidade(addr.city || addr.town || addr.village || "");
                    setEstado(addr.state || "");
                    setCep(addr.postcode || "");

                    setError("");
                } catch (err) {
                    console.error(err);
                    setError(
                        "Não foi possível converter coordenadas em endereço. Preencha manualmente."
                    );
                } finally {
                    setIsLoadingCep(false);
                }
            },
            (error) => {
                setIsLoadingCep(false);
                setError("Não foi possível obter sua localização. Verifique as permissões do navegador.");
            }
        );
    };


    const handleSaveAndContinue = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!restaurantId) {
            setError("Erro: ID do restaurante não encontrado. Volte ao início.");
            return;
        }

        if (!latitude || !longitude) {
            setError(
                "Não foi possível salvar. Precisamos das coordenadas do seu restaurante. Use um CEP válido ou o botão 'Usar minha localização'."
            );
            return;
        }
        if (!rua || !numero || !bairro || !cidade) {
            setError("Por favor, preencha o endereço completo (Rua, Número, Bairro, Cidade).");
            return;
        }

        setIsLoadingSubmit(true);
        setError("");

        const address_full = `${rua}, ${numero}, ${bairro}, ${cidade} - ${estado}, ${cep}${complemento ? `, ${complemento}` : ''}`;

        const dataToSave = {
            address: address_full, 
            latitude,
            longitude,
        };

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSave),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Falha ao salvar a localização.");
            }

            router.push("/restaurante/criar/tempo-e-taxa");
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setIsLoadingSubmit(false);
        }
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
            <div className="w-full max-w-3xl mt-12">
                <CreationStepper currentStep={1} />

                <div className="w-full max-w-lg mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Onde fica sua loja?</h1>
                    <p className="text-gray-600 mb-6">
                        Digite o CEP ou use sua localização para preencher automaticamente.
                    </p>

                    <button
                        onClick={handleUseMyLocation}
                        disabled={isLoadingCep}
                        className="w-full py-3 px-4 mb-6 border border-gray-300 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                        {isLoadingCep ? "Obtendo localização..." : "Usar minha localização"}
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-300"></span>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">ou</span>
                        </div>
                    </div>

                    <form onSubmit={handleSaveAndContinue} className="space-y-4">
                        <div>
                            <label htmlFor="cep" className="block text-sm font-medium text-gray-700">
                                CEP*
                            </label>
                            <input
                                id="cep"
                                type="text"
                                value={cep}
                                onChange={(e) => setCep(e.target.value)}
                                onBlur={handleCepBlur}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label htmlFor="cidade" className="block text-sm font-medium text-gray-700">
                                    Cidade*
                                </label>
                                <input
                                    id="cidade"
                                    type="text"
                                    value={cidade}
                                    onChange={(e) => setCidade(e.target.value)}
                                    required
                                    disabled={isLoadingCep}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100"
                                />
                            </div>
                            <div>
                                <label htmlFor="estado" className="block text-sm font-medium text-gray-700">
                                    Estado*
                                </label>
                                <input
                                    id="estado"
                                    type="text"
                                    value={estado}
                                    onChange={(e) => setEstado(e.target.value)}
                                    required
                                    disabled={isLoadingCep}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="rua" className="block text-sm font-medium text-gray-700">
                                Rua*
                            </label>
                            <input
                                id="rua"
                                type="text"
                                value={rua}
                                onChange={(e) => setRua(e.target.value)}
                                required
                                disabled={isLoadingCep}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="bairro" className="block text-sm font-medium text-gray-700">
                                Bairro*
                            </label>
                            <input
                                id="bairro"
                                type="text"
                                value={bairro}
                                onChange={(e) => setBairro(e.target.value)}
                                required
                                disabled={isLoadingCep}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-1">
                                <label htmlFor="numero" className="block text-sm font-medium text-gray-700">
                                    Número*
                                </label>
                                <input
                                    id="numero"
                                    type="text"
                                    value={numero}
                                    onChange={(e) => setNumero(e.target.value)}
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="complemento" className="block text-sm font-medium text-gray-700">
                                    Complemento
                                </label>
                                <input
                                    id="complemento"
                                    type="text"
                                    value={complemento}
                                    onChange={(e) => setComplemento(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                />
                            </div>
                        </div>

                        {error && <p className="text-center text-sm text-red-600">{error}</p>}

                        <button
                            type="submit"
                            disabled={isLoadingSubmit || isLoadingCep}
                            className="w-full mt-6 rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 disabled:opacity-60"
                        >
                            {isLoadingSubmit ? "Salvando..." : "Continuar"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}

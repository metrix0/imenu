"use client";

import { useState, useEffect } from "react";
import Input from "@/components/ui/Input";

export type AddressData = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number: string;
    complement: string;
    latitude: number | null;
    longitude: number | null;
};

interface AddressFormProps {
    initialData?: Partial<AddressData>;
    onSubmit: (data: AddressData) => Promise<void>;
    // Nova prop para comunicar validade ao pai
    onValidityChange: (isValid: boolean) => void;
}

type CepApiResponse = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    location?: {
        coordinates: {
            longitude: string;
            latitude: string;
        };
    };
};

export default function AddressForm({ 
    initialData, 
    onSubmit,
    onValidityChange 
}: AddressFormProps) {
    
    const [cep, setCep] = useState(initialData?.cep || "");
    const [state, setState] = useState(initialData?.state || "");
    const [city, setCity] = useState(initialData?.city || "");
    const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || "");
    const [street, setStreet] = useState(initialData?.street || "");
    const [number, setNumber] = useState(initialData?.number || "");
    const [complement, setComplement] = useState(initialData?.complement || "");
    const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null);
    const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null);

    const [isFetchingCep, setIsFetchingCep] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // 1. Lógica de Validação
    // Verifica se todos os campos obrigatórios estão preenchidos
    const isValid = !!(cep && state && city && neighborhood && street && number);

    // 2. Notifica o componente pai sempre que a validade mudar
    useEffect(() => {
        onValidityChange(isValid);
    }, [isValid, onValidityChange]);

    // Atualiza estados locais quando initialData muda (ex: carregamento do banco)
    useEffect(() => {
        if (initialData) {
            setCep(initialData.cep || "");
            setState(initialData.state || "");
            setCity(initialData.city || "");
            setNeighborhood(initialData.neighborhood || "");
            setStreet(initialData.street || "");
            setNumber(initialData.number || "");
            setComplement(initialData.complement || "");
            setLatitude(initialData.latitude || null);
            setLongitude(initialData.longitude || null);
        }
    }, [initialData]);

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        setIsFetchingCep(true);
        setErrorMsg("");

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
            if (!response.ok) throw new Error("CEP não encontrado.");

            const data: CepApiResponse = await response.json();

            setState(data.state);
            setCity(data.city);
            setNeighborhood(data.neighborhood);
            setStreet(data.street);

            if (data.location?.coordinates?.latitude) {
                setLatitude(parseFloat(data.location.coordinates.latitude));
                setLongitude(parseFloat(data.location.coordinates.longitude));
            } else {
                await fetchCoordinates(`${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}, Brasil`);
            }

        } catch (err) {
            console.error(err);
            setErrorMsg("Erro ao buscar CEP. Preencha manualmente.");
        } finally {
            setIsFetchingCep(false);
        }
    };

    const fetchCoordinates = async (fullAddress: string) => {
        try {
            const geoResponse = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`
            );
            const geoData = await geoResponse.json();

            if (geoData && geoData.length > 0) {
                setLatitude(parseFloat(geoData[0].lat));
                setLongitude(parseFloat(geoData[0].lon));
            } else {
                setLatitude(null);
                setLongitude(null);
            }
        } catch (e) {
            console.error("Error fetching coords", e);
        }
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            setErrorMsg("Geolocalização não suportada.");
            return;
        }

        setIsFetchingCep(true);
        setErrorMsg("");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lon } = position.coords;
                setLatitude(lat);
                setLongitude(lon);

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
                    );
                    if (!response.ok) throw new Error("Erro ao obter endereço.");

                    const data = await response.json();
                    const addr = data.address || {};

                    setStreet(addr.road || "");
                    setNeighborhood(addr.suburb || addr.neighbourhood || "");
                    setCity(addr.city || addr.town || addr.village || "");
                    setState(addr.state || "");
                    setCep(addr.postcode || "");

                } catch (err) {
                    setErrorMsg("Não foi possível obter o endereço completo.");
                } finally {
                    setIsFetchingCep(false);
                }
            },
            () => {
                setIsFetchingCep(false);
                setErrorMsg("Permissão de localização negada.");
            }
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) {
            setErrorMsg("Preencha o endereço completo.");
            return;
        }

        if (!latitude || !longitude) {
            setErrorMsg("Não conseguimos identificar a localização exata. Verifique o CEP.");
            return;
        }

        onSubmit({
            cep, state, city, neighborhood, street, number, complement, latitude, longitude
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto px-4">
            <div className="mb-8 text-center sm:text-left mt-8">
                <h1 className="text-4xl font-bold text-gray-900">Onde fica sua loja?</h1>
                <p className="text-gray-500 mt-1">Digite o CEP e complete as informações.</p>
            </div>

            <div className="mb-8">
                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={isFetchingCep}
                    className="w-full py-3 border border-gray-300 rounded-md text-brand font-medium hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-brand focus:outline-none cursor-pointer"
                >
                    {isFetchingCep ? "Buscando..." : "Usar minha localização"}
                </button>
            </div>

            {/* ID "address-form" ESSENCIAL para o botão externo funcionar */}
            <form id="address-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-gray-700">CEP*</label>
                        <a 
                            href="https://buscacepinter.correios.com.br/app/endereco/index.php" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-brand hover:underline font-medium"
                        >
                            Descubra seu CEP
                        </a>
                    </div>
                    <Input
                        value={cep}
                        onChange={(e) => setCep(e.target.value)}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                        <Input
                            label="Estado*"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            required
                            disabled={isFetchingCep}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Input
                            label="Cidade*"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            required
                            disabled={isFetchingCep}
                        />
                    </div>
                </div>

                <Input
                    label="Bairro*"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ex: Centro"
                    required
                />

                <Input
                    label="Rua*"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ex: Avenida Paulista"
                    required
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                        <Input
                            label="Número*"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            required
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <Input
                            label="Complemento"
                            value={complement}
                            onChange={(e) => setComplement(e.target.value)}
                            placeholder="Apto 101, Bloco B"
                        />
                    </div>
                </div>

                {errorMsg && (
                    <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">
                        {errorMsg}
                    </p>
                )}
            </form>
        </div>
    );
}
// components/restaurant-owner/configuracoes/AddressForm.tsx
"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faLocationCrosshairs
} from "@fortawesome/free-solid-svg-icons";

import Input from "@/components/ui/Input";
import { fetchAddressByCEP, fetchCoordinates, fetchAddressByCoordinates } from "@/lib/api/geocoding";

import { AddressData } from "@/lib/types/types";
import Button from "@/components/ui/Button";

interface AddressFormProps {
    initialData?: Partial<AddressData>;
    onSubmit: (data: AddressData) => Promise<void>;
    onValidityChange: (isValid: boolean) => void;
    isLoading?: boolean;
    submitLabel?: string;
}

export default function AddressForm({ 
    initialData, 
    onSubmit, 
    isLoading = false, 
    submitLabel = "Continuar",
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

    const isValid = !!(cep && state && city && neighborhood && street && number);

    useEffect(() => {
        onValidityChange(isValid);
    }, [isValid, onValidityChange]);

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
            // 1. Busca dados do CEP
            const address = await fetchAddressByCEP(cleanCep);
            if (!address) throw new Error("CEP não encontrado.");

            setState(address.state);
            setCity(address.city);
            setNeighborhood(address.neighborhood);
            setStreet(address.street);

            // 2. Se a API de CEP não trouxe lat/lon, busca no Nominatim via endereço completo
            if (address.latitude && address.longitude) {
                setLatitude(address.latitude);
                setLongitude(address.longitude);
            } else {
                const fullAddr = `${address.street}, ${address.neighborhood}, ${address.city} - ${address.state}, Brasil`;
                const coords = await fetchCoordinates(fullAddr);
                if (coords) {
                    setLatitude(coords.latitude);
                    setLongitude(coords.longitude);
                } else {
                    setLatitude(null);
                    setLongitude(null);
                }
            }

        } catch (err) {
            console.error(err);
            setErrorMsg("Erro ao buscar CEP. Preencha manualmente.");
        } finally {
            setIsFetchingCep(false);
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
                    const address = await fetchAddressByCoordinates(lat, lon);
                    if (!address) throw new Error("Endereço não encontrado.");

                    setStreet(address.street);
                    setNeighborhood(address.neighborhood);
                    setCity(address.city);
                    setState(address.state);
                    setCep(address.cep);
                    if(address.number) setNumber(address.number);

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
            // Tenta uma última vez obter coordenadas antes de enviar
            const fullAddr = `${street}, ${neighborhood}, ${city} - ${state}, Brasil`;
            fetchCoordinates(fullAddr).then(coords => {
                 if (coords) {
                     onSubmit({
                         cep, state, city, neighborhood, street, number, complement, 
                         latitude: coords.latitude, longitude: coords.longitude
                     });
                 } else {
                     setErrorMsg("Não conseguimos identificar a localização exata. Verifique o endereço.");
                 }
            });
            return;
        }

        onSubmit({
            cep,
            state,
            city,
            neighborhood,
            street,
            number,
            complement,
            latitude,
            longitude
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
                    disabled={isFetchingCep || isLoading}
                    className="w-full py-3 border border-gray-300 rounded-md text-brand font-medium hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-brand focus:outline-none cursor-pointer 2xl:text-lg"
                >
                    {isFetchingCep ? "Buscando..." : <><FontAwesomeIcon icon={faLocationCrosshairs}/> Usar minha localização</>}
                </button>
            </div>

            <form id="address-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-gray-700">CEP*</label>
                        <a 
                            href="https://buscacepinter.correios.com.br/app/endereco/index.php" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs 2xl:text-sm text-brand hover:underline font-medium"
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

                {/* BOTÃO FIXO NO RODAPÉ */}
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 2xl:p-5 flex justify-end z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                     <div className="w-full max-w-4xl mx-auto flex justify-end">
                        <Button
                            variant={!isValid ? "secondary" : "primary"}
                            disabled={!isValid || isLoading}
                            loading={isLoading}
                            type="submit"
                            className="w-full sm:w-auto px-8 2xl:px-10 py-3 2xl:py-4 2xl:text-lg text-base disabled:pointer-events-none"
                        >
                            {submitLabel}
                        </Button>
                     </div>
                </div>
            </form>
        </div>
    );
}
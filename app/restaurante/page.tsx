"use client";

import {useEffect, useState} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import BonusButton from "@/components/ui/BonusButton";
import "@/app/reveal.css"


export default function RestaurantRegistrationPage() {
  const router = useRouter();
  const { setRestaurantId, setEmail: saveEmailToStore } = useCreationStore();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
    const [restCount, setRestCount] = useState<number>(0);


    useEffect(() => {
        (async () => {
            const totalBonus = 30 + 10 //+10 for test restaurants
            setRestCount(totalBonus - ((await fetch("/api/restaurants/count").then(r => r.json())).count))
            setRestCount(15)
        })();
    }, []);

  // Validações

  const isValid = 
    email.includes("@") && 
    email.includes(".") && 
    fullName.length > 3 && 
    phone.length >= 14 && 
    password.length >= 6;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    let formatted = "";
    if (value.length > 0) formatted = "(" + value.slice(0, 2);
    if (value.length > 2) formatted += ") " + value.slice(2, 7);
    if (value.length > 7) formatted += "-" + value.slice(7);

    setPhone(formatted);
  };

  const handleRegister = async () => {
    if (!isValid) return;
    setLoading(true);
    setErrorMsg("");

    // Salva e-mail no Zustand
    saveEmailToStore(email);

    try {
      // 1. Criar o Usuário na Autenticação (Supabase Auth)
      // IMPORTANTE: Para não enviar OTP, desabilite "Confirm Email" no painel do Supabase.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          },
        },
      });

      if (authError) throw authError;
      
      // Se "Confirm Email" estiver ligado, authData.user existe mas authData.session é null.
      // Se estiver desligado (como você quer), ambos existem.
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      const userId = authData.user.id;

      // 2. Criar o Restaurante JÁ VINCULADO ao ID do Usuário
      const res = await fetch("/api/restaurants/create", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              userId: userId,  // Enviamos o ID do Auth
              phone: phone,    // Enviamos o telefone para salvar no banco também
              email: email     // Enviamos o email (caso queira usar no futuro/logs)
          })
      });
      
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Falha ao criar restaurante.");
      }
      
      const restaurantData = await res.json();
      
      // 3. Salva o novo ID do restaurante no Zustand
      setRestaurantId(restaurantData.id);

      // 4. Redireciona
      router.push("/restaurante/criar/localizacao");

    } catch (err) {
      console.error(err);
      setErrorMsg((err as Error).message || "Erro ao realizar cadastro.");
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
        if(!restCount) return
        const els = document.querySelectorAll(".reveal");

        const obs = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        obs.unobserve(entry.target); // animate once
                    }
                });
            },
            { threshold: 0.5 }
        );

        els.forEach(el => obs.observe(el));
    }, [restCount]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full px-2 py-6 flex items-center justify-between top-0 bg-white z-10">
        <div className="relative h-6 w-32 ml-4">
            <Image src="/logos/CombinationMarkLogo_Brand.png" alt="iMenu Logo" fill className="object-contain object-left" />
        </div>
      </header>


        <div className="relative flex justify-center w-full min-h-screen px-4 py-10">

            {/* LEFT BONUS CARD */}
            {restCount > 0 && (
                <div className="reveal fade-up absolute left-18 top-1/2 -translate-y-1/2 ">
                    <div className="opacity-95 text-white max-w-80 space-y-2 p-6 border bg-text border-gray-950 rounded-xl shadow-sm">
                        <BonusButton className="!pr-8 pl-6  border-1">
                            <span className="font-medium">BÔNUS</span>
                        </BonusButton>

                        <p className="text-sm font-light p-2 leading-tight">
                            <b>Para os próximos {restCount} restaurantes que se cadastrarem:</b>
                            <br/>
                            <span className="mt-3 block">
          Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês.
        </span>
                        </p>
                    </div>
                </div>
            )}

            {/* MAIN EXACT CENTER */}
            <main className="flex flex-col items-center justify-start flex-1 max-w-lg">
                <Card className="w-full space-y-6 p-8 border border-gray-200 shadow-sm">
                    <div className="text-center space-y-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                            Crie seu Cardápio Digital
                        </h1>
                    </div>

                    <div className="space-y-5">
                        <Input
                            label="E-mail*"
                            placeholder="seu@email.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <Input
                            label="Nome*"
                            placeholder="Nome Sobrenome"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />

                        <div>
                            <Input
                                label="Celular (WhatsApp)*"
                                placeholder={isPhoneFocused ? "(__) _____-____" : "(00) 00000-0000"}
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                onFocus={() => setIsPhoneFocused(true)}
                                onBlur={() => setIsPhoneFocused(false)}
                                maxLength={15}
                            />
                            <p className="text-xs text-gray-400 pt-1">
                                Usado apenas para suporte e casos de emergência.
                            </p>
                        </div>

                        <div>
                            <Input
                                label="Senha*"
                                placeholder="Crie uma senha segura"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <p className="text-xs text-gray-400 pt-1">Mínimo de 6 caracteres.</p>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600 text-center">
                                {errorMsg}
                            </div>
                        )}
                    </div>
                </Card>

                <div className="mt-6">
                    <div className={`w-auto ${!isValid ? "cursor-not-allowed" : ""}`}>
                        <Tooltip
                            text="Preencha os dados obrigatórios"
                            className={isValid ? "!hidden" : ""}
                        >
                            <Button
                                variant={!isValid ? "secondary" : "primary"}
                                loading={loading}
                                disabled={!isValid}
                                onClick={handleRegister}
                                className="min-w-[220px] disabled:pointer-events-none disabled:opacity-50"
                            >
                                Criar Conta Grátis
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </main>
        </div>


    </div>
  );
}
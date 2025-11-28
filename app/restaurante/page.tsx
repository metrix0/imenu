"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; 
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RestaurantRegistrationPage() {
  const router = useRouter();
  
  // 1. Atualizado: Pegamos todos os setters e os valores salvos
  const { 
    setRestaurantId, 
    setEmail: saveEmailToStore,
    setFullName: saveFullNameToStore,
    setPhone: savePhoneToStore,
    email: storedEmail,
    fullName: storedName,
    phone: storedPhone
  } = useCreationStore();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);

  // --- LÓGICA PARA BARRA FIXA INTELIGENTE ---
  const [isAtBottom, setIsAtBottom] = useState(false);
  const footerSentinelRef = useRef<HTMLDivElement>(null);

  // 2. Atualizado: Preenchemos TODOS os campos se existirem no store
  useEffect(() => {
    if (storedEmail) setEmail(storedEmail);
    if (storedName) setFullName(storedName);
    if (storedPhone) setPhone(storedPhone);
  }, [storedEmail, storedName, storedPhone]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: "0px" }
    );

    if (footerSentinelRef.current) {
      observer.observe(footerSentinelRef.current);
    }

    return () => {
      if (footerSentinelRef.current) observer.unobserve(footerSentinelRef.current);
    };
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

    // 3. Atualizado: Salvamos TUDO no store antes de prosseguir
    saveEmailToStore(email);
    saveFullNameToStore(fullName);
    savePhoneToStore(phone);

    try {
      // Cria usuário
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
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      const userId = authData.user.id;

      // Cria restaurante
      const res = await fetch("/api/restaurants/create", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              userId: userId,
              phone: phone,
              email: email
          })
      });
      
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Falha ao criar restaurante.");
      }
      
      const restaurantData = await res.json();
      setRestaurantId(restaurantData.id);

      router.push("/restaurante/criar/localizacao");

    } catch (err) {
      console.error(err);
      setErrorMsg((err as Error).message || "Erro ao realizar cadastro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white relative">
      <header className="w-full border-b border-gray-200 px-2 py-7 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="relative h-6 w-32 ml-4">
            <Image src="/logo-full.png" alt="iMenu Logo" fill className="object-contain object-left" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-8 px-4 pb-32 sm:pt-16">
        <Card className="w-full max-w-2xl space-y-8 p-8 border border-gray-200 shadow-sm">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Crie seu Cardápio Digital</h1>
            <p className="text-base text-gray-500">Preencha seus dados para começar de graça.</p>
          </div>

          <div className="space-y-6">
            <Input 
                label="E-mail*" 
                placeholder="seu@email.com" 
                type="email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
            />

            <Input 
                label="Nome completo*" 
                placeholder="Nome Sobrenome" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
            />
            
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
      </main>

      <div ref={footerSentinelRef} className="absolute bottom-0 w-full h-px pointer-events-none opacity-0" />

      <footer 
        className={`sticky w-full bg-white border-t border-gray-200 px-6 py-4 transition-all duration-200 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]
            ${isAtBottom ? "absolute bottom-0" : "fixed bottom-0"}`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1"></div> 
          
          <div className={`w-auto ${!isValid ? "cursor-not-allowed" : ""}`}>
            <Button
                variant={!isValid ? "secondary" : "primary"}
                loading={loading}
                disabled={!isValid}
                onClick={handleRegister}
                className="w-full sm:w-auto px-8 py-3 text-base disabled:pointer-events-none disabled:opacity-50"
            >
                {isValid ? "Criar Conta Grátis" : "Preencha os dados"}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
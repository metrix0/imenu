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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons/faEyeSlash";
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye";


export default function RestaurantRegistrationPage() {
  const router = useRouter();
  const { setRestaurantId, setEmail: saveEmailToStore, setDraftRegisterData, draftRegisterData } = useCreationStore();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [restCount, setRestCount] = useState<number>(0);



    // 1. Carregar dados salvos ao montar a página
  useEffect(() => {
      if (draftRegisterData) {
          setEmail(draftRegisterData.email || "");
          setFullName(draftRegisterData.fullName || "");
          setPhone(draftRegisterData.phone || "");
      }
  }, [draftRegisterData]);

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

    saveEmailToStore(email);
    setDraftRegisterData({ email, fullName, phone });

    try {
      // 1. Tentar Criar Usuário
      let userId = "";
      
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

      if (authError) {
        // Se o erro for "usuário já existe", tentamos logar para recuperar o fluxo
        // Nota: A mensagem exata pode variar, verifique o log do Supabase
        if (authError.message.includes("already registered") || authError.status === 400) {
           console.log("Usuário já existe, tentando login para continuar...");
           const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
             email,
             password
           });
           
           if (loginError) {
             throw new Error("Este e-mail já está cadastrado. Tente fazer login.");
           }
           
           if (loginData.user) {
             userId = loginData.user.id;
           }
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error("Erro ao criar usuário.");
        userId = authData.user.id;
      }

      if (!userId) throw new Error("Falha na autenticação.");

      // 2. Tentar Criar o Restaurante (Idempotência ou Verificação)
      
      // Primeiro, verificamos se já existe um restaurante para este usuário (para evitar duplicatas no retry)
      const { data: existingRest } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let finalRestaurantId = existingRest?.id;

      if (!finalRestaurantId) {
          // Se não existe, cria
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
              // Se falhar aqui, o usuário existe mas não tem restaurante.
              // O usuário verá o erro, mas poderá clicar em "Criar Conta" de novo.
              // Graças à lógica de "tentar login" acima, na próxima vez ele vai logar e cair aqui de novo.
              throw new Error(errData.error || "Falha ao criar restaurante. Tente novamente.");
          }
          
          const restaurantData = await res.json();
          finalRestaurantId = restaurantData.id;
      }
      
      // 3. Sucesso
      setRestaurantId(finalRestaurantId);
      router.push("/restaurante/criar/localizacao");

    } catch (err) {
      console.error(err);
      setErrorMsg((err as Error).message || "Erro ao realizar cadastro.");
      // Se falhar, o loading para e o usuário pode tentar novamente.
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


        <div className="relative flex justify-center w-full min-h-[80vh] items-center px-4 2xl:py-8">

            {/* LEFT BONUS CARD */}


            {/* MAIN EXACT CENTER */}
            <main className="flex flex-col items-center justify-start flex-1 max-w-lg 2xl:max-w-xl ">
                <Card className="relative w-full space-y-6 p-8 2xl:p-12 border border-gray-200 shadow-sm 2xl:shadow-lg">
                    {restCount > 0 && (
                        <div className="reveal fade-up absolute -right-90 2xl:-right-100 top-0">
                            <div className="opacity-95 text-white max-w-80 2xl:max-w-90 space-y-2 p-8 border bg-text border-gray-950 rounded-xl shadow-sm">
                                <BonusButton className="!pr-8 pl-6 border-1 border-gray-700">
                                    <span className="font-medium">BÔNUS</span>
                                </BonusButton>

                                <p className="text-sm 2xl:text-lg font-light leading-tight">
                                    <b>Para os próximos {restCount} restaurantes que se cadastrarem:</b>
                                    <br/>
                                    <span className="mt-3 block">
          Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês.
        </span>
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="text-center space-y-0">
                        <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-gray-900">
                            Crie seu Cardápio Digital
                        </h1>
                    </div>

                    <div className="space-y-5">
                        <Input
                            label="E-mail*"
                            placeholder="seu@email.com"
                            type="email"
                            value={email}
                            autoComplete={"email"}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <Input
                            label="Nome*"
                            placeholder="Nome Sobrenome"
                            value={fullName}
                            autoComplete={"name"}
                            onChange={(e) => setFullName(e.target.value)}
                        />

                        <div>
                            <Input
                                label="Celular (WhatsApp)*"
                                placeholder={isPhoneFocused ? "(__) _____-____" : "(00) 00000-0000"}
                                type="tel"
                                value={phone}
                                autoComplete={"tel"}
                                onChange={handlePhoneChange}
                                onFocus={() => setIsPhoneFocused(true)}
                                onBlur={() => setIsPhoneFocused(false)}
                                maxLength={15}
                            />
                            <p className="text-xs text-gray-400 pt-1 2xl:pt-2 2xl:text-sm">
                                Usado apenas para suporte e casos de emergência.
                            </p>
                        </div>

                        <div className="relative">
                            <Input
                                label="Senha*"
                                placeholder="Crie uma senha segura"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setPasswordFocused(true)}
                                onBlur={() => setPasswordFocused(false)}
                            />
                            {(passwordFocused || showPassword) && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                    e.preventDefault(); // 🔑 NÃO perde o foco do input
                                    setShowPassword(prev => !prev);
                                }}
                                    className="tabIndex={-1} cursor-pointer absolute right-3 top-[38px] text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    {showPassword ? <FontAwesomeIcon icon={faEyeSlash} className="mr-2" /> : <FontAwesomeIcon icon={faEye} className="mr-2" />}
                                </button>
                            )}
                            <p className="text-xs text-gray-400 pt-1 2xl:pt-2 2xl:text-sm">Mínimo de 6 caracteres.</p>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600 text-center">
                                {errorMsg}
                            </div>
                        )}
                    </div>

                        <div className={`mt-8 flex justify-center w-full ${!isValid ? "cursor-not-allowed" : ""}`}>
                            <Tooltip
                                text="Preencha os dados obrigatórios"
                                className={isValid ? "!hidden" : ""}
                                parentClassName={"w-full"}
                            >
                                <Button
                                    variant={"primary"}
                                    loading={loading}
                                    disabled={!isValid}
                                    onClick={handleRegister}
                                    className="min-w-[220px] w-full disabled:pointer-events-none 2xl:text-xl"
                                >
                                    Criar Conta Grátis
                                </Button>
                            </Tooltip>
                    </div>
                    <p className={"text-sm 2xl:text-base"}>
                        Já tem uma conta? <a className={"text-blue-500 hover:text-blue-700 duration-200 cursor-pointer"} onClick={()=>router.replace("login")}>Log In</a>
                    </p>
                </Card>


            </main>
        </div>


    </div>
  );
}
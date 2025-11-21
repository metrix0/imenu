"use client";

import Image from "next/image";
import BonusButton from "@/components/ui/BonusButton";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faClock } from "@fortawesome/free-solid-svg-icons";
import posthog from "posthog-js";

export default function LandingPage() {

    // SECTION 2 – troca de imagem
    const logos = [
        { id: 1, name: "Logo 1", src: "/imenu.png", second_src:"/iMenu MENU.png" },
        { id: 2, name: "Logo 2", src: "/imenu.png", second_src:"/iMenu MENU.png" },
        { id: 3, name: "Logo 3", src: "/imenu.png", second_src:"/iMenu MENU.png" },
    ];
    const [selected, setSelected] = useState(1);

    useEffect(() => {
        posthog.capture("landing_page_viewed", { source: "public_landing" });
    }, []);

    return (
        <div className="w-full">

            {/* ================= NAVBAR ================= */}
            <header className="w-full flex items-center justify-between py-5 px-8 border-gray-200 bg-white">
                <div className="flex items-center gap-2 text-xl font-bold text-brand">
                    <Image
                        src="/logo-full.png"
                        alt="iMenu Logo"
                        width={120}
                        height={32}
                        className="h-6 w-auto ml-4 cursor-pointer"
                    />
                </div>

                <nav className="flex items-center gap-8 text-sm font-medium">
                    <a href="#" className="hover:text-gray-500 transition">Home</a>
                    <a href="#" className="hover:text-gray-500 transition">Recursos</a>

                    <Tooltip
                        text={
                            <span>
                                Para os próximos 26 restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês.{" "}
                                <u className={"cursor-pointer"}>Saiba mais</u>
                            </span>
                        }
                        size={"medium"}
                        padding={"p-4"}
                        position={"bottom"}
                    >
                        <BonusButton>
                            <span className="inline-block">
                                <span className="text-[0.8rem]">BÔNUS</span>{" "}
                                <span className="font-light">para prox. 26 restaurantes</span>
                            </span>
                        </BonusButton>
                    </Tooltip>

                    <div className="w-[1px] h-6 bg-gray-300" />

                    <a href="#" className="flex items-center gap-1 hover:text-gray-500 transition text-gray-600">
                        <FontAwesomeIcon icon={faUser} />
                        Login
                    </a>

                    <Button variant="primary">
                        Registrar Grátis
                    </Button>
                </nav>
            </header>

            {/* ================= SECTION 1 ================= */}
            <section className="relative mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 px-15 py-20 h-[89vh] ">
                <div className="flex flex-col justify-center">
                    <h1 className="text-5xl font-extrabold mb-2 -mt-4 text-brand leading-tight ">
                        O novo Cardápio Digital
                        <br /><span className={"text-text"}>de Alta Conversão</span>
                    </h1>

                    <p className="text-gray-500 leading-15">
                        Sem taxas, sem mensalidades, sem pegadinhas.{" "}
                        <a className="underline">Para sempre.</a>
                    </p>
                    <p className="text-gray-500">Seu cardápio online em 5 minutos.</p>

                    <div className="flex items-center gap-4 mt-6">
                        <Button variant="primary" className="px-6 py-3 text-lg">
                            Registrar Grátis
                        </Button>

                        <Tooltip
                            text={
                                <span>
                                    Para os próximos 26 restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês.{" "}
                                    <u className={"cursor-pointer"}>Saiba mais</u>
                                </span>
                            }
                            size={"medium"}
                            padding={"p-4"}
                            position={"right"}
                        >
                            <BonusButton>
                                <span className="font-regular text-xs">BÔNUS</span>
                            </BonusButton>
                        </Tooltip>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    <div className="absolute h-[100%] w-100 overflow-hidden top-0">
                        <video
                            src="/renderr.webm"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </div>
                </div>
            </section>

            {/* ================= SECTION 2 ================= */}
            <section className="py-15 px-8 h-[100vh]">
                <h2 className="text-center text-4xl font-extrabold text-brand mb-16">
                    Totalmente Grátis<br/>
                    <span className={"text-text"}>sem taxas ou pegadinhas</span>
                </h2>

                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">

                    {/* LEFT – Logos + Image */}
                    <div className="flex gap-6 items-start h-[55vh]">

                        {/* Logos */}
                        <div className="h-[100%] flex flex-col gap-5 pt-4 items-center justify-center">
                            {logos.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => setSelected(l.id)}
                                    className={`transition rounded-full p-1 ${
                                        selected === l.id ? "scale-115 opacity-100" : "opacity-30"
                                    }`}
                                >
                                    <div className="cursor-pointer w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                        <Image
                                            src={l.src}
                                            alt={l.name}
                                            width={50}
                                            height={50}
                                            className={`w-full h-full object-contain transition ${
                                                selected === l.id ? "grayscale-0" : "grayscale"
                                            }`}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Main image */}
                        <div className="flex-1 flex gap-6 relative h-full">
                            <div
                                key={selected}
                                className="
                                    relative h-[100%] rounded-xl overflow-hidden
                                    animate-fadeUp drop-shadow-[-5px_5px_5px_rgba(0,0,0,0.15)]
                                "
                            >
                                <Image
                                    src={logos.find(l => l.id === selected)?.second_src || "/iMenu Menu.png"}
                                    alt="Preview do cardápio digital"
                                    width={1080}
                                    height={1920}
                                    className="h-full w-auto"
                                />
                            </div>

                            <div className="flex flex-col gap-12 w-[50%] ml-3">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">+30% Estatística</h3>
                                    <p className="text-gray-500">Em 1 mês com o cardápio digital.</p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Criado em 5 minutos</h3>
                                    <p className="text-gray-500">
                                        A Inteligência Artificial reconhece a foto do seu cardápio.
                                    </p>
                                </div>

                                <Button variant="primary" className="px-6 py-3 text-lg">
                                    Registrar Grátis
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT – Big image */}
                    <div className="flex items-center justify-center relative h-[55vh]">
                        <div className="relative h-full overflow-hidden">
                            <Image
                                src="/wip-monitor2.png"
                                alt="Destaque do painel e resultados"
                                width={1080}
                                height={1920}
                                className="h-full w-auto"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= SECTION 3 ================= */}
            <section className="py-20 px-8 bg-gray-50">
                <h2 className="text-center text-4xl font-bold text-brand mb-8">
                    Funções que ajudam seu restaurante a vender mais
                </h2>

                <p className="text-center text-gray-500 max-w-2xl mx-auto mb-16">
                    O iMenu foi criado para ser simples, rápido e eficiente.  
                    Aumente conversão, reduza fricção e ofereça a melhor experiência ao seu cliente.
                </p>

                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">

                    <div className="p-8 bg-white rounded-2xl shadow-md">
                        <h3 className="text-xl font-bold mb-3">Cardápio Inteligente</h3>
                        <p className="text-gray-500">
                            O cliente acessa, escolhe e visualiza tudo com fotos de alta qualidade.
                        </p>
                    </div>

                    <div className="p-8 bg-white rounded-2xl shadow-md">
                        <h3 className="text-xl font-bold mb-3">Estatísticas Reais</h3>
                        <p className="text-gray-500">
                            Veja quais itens mais vendem e quais passam despercebidos.
                        </p>
                    </div>

                    <div className="p-8 bg-white rounded-2xl shadow-md">
                        <h3 className="text-xl font-bold mb-3">Atualização Instantânea</h3>
                        <p className="text-gray-500">
                            Alterou o preço? Adicionou foto? Tudo atualiza na hora.
                        </p>
                    </div>

                </div>

                <div className="flex justify-center mt-16">
                    <Button variant="primary" className="px-8 py-4 text-lg">
                        Criar Meu Cardápio Grátis
                    </Button>
                </div>
            </section>

        </div>
    );
}

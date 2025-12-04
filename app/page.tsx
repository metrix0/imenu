"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import BonusButton from "@/components/ui/BonusButton";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import Footer from "@/components/common/Footer";
import "@/app/reveal.css"

export default function LandingPage() {
    // SECTION 2 – troca de imagem
    const logos = [
        { id: 1, name: "Logo 1", src: "/images/Menu_Mockup_Logo_3.png", second_src:"/images/Menu_Mockup_3.png" },
        { id: 2, name: "Logo 1", src: "/images/Menu_Mockup_Logo_2.png", second_src:"/images/Menu_Mockup_2.png" },
        { id: 3, name: "Logo 1", src: "/images/Menu_Mockup_Logo_1.png", second_src:"/images/Menu_Mockup_1.png" },
    ];
    const [selected, setSelected] = useState(1);
    const [restCount, setRestCount] = useState<number>(0);
    let shouldRun = useRef<boolean>(true);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const totalBonus = 30 + 10 //+10 for test restaurants
            setRestCount(totalBonus - ((await fetch("/api/restaurants/count").then(r => r.json())).count))
            setRestCount(15)
        })();
    }, []);

    useEffect(() => {
        const els = document.querySelectorAll(".reveal");

        const obs = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        if(entry.target.id === "logos"){
                            setTimeout(() => autoPassLogos(), 4500)
                        }
                        obs.unobserve(entry.target); // animate once
                    }
                });
            },
            { threshold: 0.5 }
        );

        els.forEach(el => obs.observe(el));
    }, []);

    function autoPassLogos(delay = 4500) {
        let currentIndex = logos.findIndex((l) => l.id === selected);
        if (currentIndex === -1) currentIndex = 0;

        function step() {
            if(!shouldRun.current) return
            currentIndex = (currentIndex + 1) % logos.length; // always forward
            setSelected(logos[currentIndex].id);
            setTimeout(step, delay);
        }
        if(!shouldRun.current) return

        step();
    }

    return (
        <div className="w-full">

            {/* ================= NAVBAR ================= */}
            <header className="w-full flex items-center justify-between py-5 px-8 border-gray-200 bg-white">
                {/* Left – Logo */}
                <div className="flex items-center gap-2 text-xl font-bold text-brand">
                    {/* Logo placeholder */}
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        width={120}
                        height={32}
                        className="h-6 w-auto ml-4 cursor-pointer"
                        onClick={() => router.push("#")}
                    />
                </div>

                {/* Right */}
                <nav className="flex items-center gap-8 text-sm font-medium">
                    <a href="#" className="hover:text-gray-500 transition">Home</a>
                    <a href="#recursos" className="hover:text-gray-500 transition">Recursos</a>
                    {restCount >= 0 && (
                        <Tooltip text={<span>Para os próximos {restCount} restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"} onClick={() => router.push("/restaurante/registrar")}>Cadastre-se agora</u></span>} size={"medium"} padding={"p-4"} position={"bottom"}>
                            <BonusButton><span className="inline-block"><span className={"text-[0.8rem]"}>BÔNUS</span> <span className="font-light">para prox. {restCount} restaurantes</span></span></BonusButton>
                        </Tooltip>
                    )}

                    <div className="w-[1px] h-6 bg-gray-300" />

                    <a onClick={() => router.push("/restaurante/login")} className="cursor-pointer flex items-center gap-1 hover:text-gray-500 transition text-gray-600">
                        <FontAwesomeIcon icon={icons.faUser} />
                        Login
                    </a>

                    <Button variant="primary" onClick={() => router.push("/restaurante/registrar")}>
                        Registrar Grátis
                    </Button>
                </nav>
            </header>

            {/* ================= SECTION 1 ================= */}
            <section className="relative mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 px-15 py-20 h-[89vh] ">

                {/* Left – Text */}
                <div className="flex flex-col justify-center">
                    <h1 className="text-5xl font-extrabold mb-2 -mt-4 text-brand leading-tight ">
                        O novo Cardápio Digital
                        <br/><span className={"text-text"}>de Alta Conversão</span>
                    </h1>

                    <p className="text-gray-500 leading-15">
                        Sem taxas, sem mensalidades, sem pegadinhas.{" "}
                        <Tooltip text={"O iMenu é completamente grátis, para sempre."} position={"right"}><a href={"#recursos"} className="underline cursor-pointer">Para sempre.</a></Tooltip>
                    </p>
                    <p className="text-gray-500">Seu cardápio online em 5 minutos.</p>

                    <div className="flex items-center gap-4 mt-6">
                        <Button variant="primary" onClick={() => router.push("/restaurante/registrar")} className="px-6 py-3 text-lg">
                            Registrar Grátis
                        </Button>
                        {restCount >= 0 && (
                            <Tooltip text={<span>Para os próximos {restCount} restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"} onClick={() => router.push("/restaurante/registrar")}>Cadastre-se agora</u></span>} size={"medium"} padding={"p-4"} position={"bottom"}><BonusButton><span className="font-regular text-xs">BÔNUS</span></BonusButton></Tooltip>
                        )}
                        <div className="w-[1px] h-6 bg-gray-300" />

                        <a onClick={() => router.push("/restaurante/login")} className="cursor-pointer flex items-center gap-1 hover:text-gray-500 transition text-gray-600">
                            <FontAwesomeIcon icon={icons.faUser} />
                            Login
                        </a>

                    </div>

                </div>
                {/* Right – Video placeholder (image) */}
                <div className="flex items-center justify-center">
                    <div className="absolute h-[100%] w-100 overflow-hidden top-0">
                        <video
                            src="/images/CellphoneVideo.webm"
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
                <h2 className="text-center text-4xl font-extrabold text-brand mb-13 reveal fade-up">
                    Totalmente Grátis<br/>
                    <span className={"text-text"}>sem taxas, sem pegadinhas</span>
                </h2>

                <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12">

                    {/* LEFT – Logos + Image */}
                    <div className="flex gap-10 items-start h-[63vh] flex-1">

                        {/* Logos */}
                        <div id={"logos"} className="reveal fade-up h-[100%] flex flex-col gap-5 pt-4 items-center justify-center">
                            {logos.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => setSelected(l.id)}
                                    className={`transition rounded-full p-1 ${
                                        selected === l.id ? "scale-115 opacity-100" : "opacity-66"
                                    }`}
                                >
                                    <div onClick={() => shouldRun.current = false} className="cursor-pointer w-12 h-12 rounded-full  hover:scale-110 duration-200 overflow-hidden bg-gray-200 flex items-center justify-center">
                                        <Image
                                            src={l.src}
                                            alt={l.name}
                                            width={50}
                                            height={50}
                                            className={`w-full h-full object-contain transition ${
                                                selected === l.id ? "grayscale-0" : "grayscale-50"
                                            }`}                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Main image */}
                        <div className="reveal fade-right delay-300 flex-1 flex gap-8 relative h-full z-50">
                            <div className={"w-[45%]"}>
                                <div
                                    key={selected}
                                    className="
                relative h-[100%]
                animate-fadeUp
            "
                                >
                                    <Image
                                        src={logos.find(l => l.id === selected)?.second_src || "/iMenu Menu.png"}
                                        alt="Preview do cardápio digital"
                                        width={1080}
                                        height={1920}
                                        className="h-full w-auto drop-shadow-[0px_5px_5px_rgba(0,0,0,0.1)] rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-12 w-[43%] ml-3  justify-center z-40">
                                <div>
                                    <h3 className="text-lg font-bold mb-1">Venda sem taxas</h3>
                                    <p className="text-gray-500">Receba 100% do valor que você vendeu.</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold mb-1">Criado em 5 minutos</h3>
                                    <p className="text-gray-500 z-50">A <Tooltip className={"z-50"} text={"Nossa IA realiza o scan da foto ou PDF do seu cardápio."} position={"right"}><u className={"cursor-pointer"}>Inteligência Artificial</u></Tooltip> reconhece a foto do seu cardápio.</p>
                                </div>

                                <Button variant="primary" onClick={() => router.push("/restaurante/registrar")} className="px-6 py-3 text-lg mb-3">
                                    Registrar Grátis
                                </Button>

                            </div>
                        </div>
                    </div>

                    {/* RIGHT – Big image */}
                    <div className="flex items-center justify-center relative h-[63vh] flex-1 z-1">
                        <div className="relative h-full w-full delay-500 reveal fade-left z-1">
                            <Image
                                src="/images/MonitorGraph.png"
                                alt="Destaque do painel e resultados"
                                width={1080}
                                height={1920}
                                className="h-[105%] -mt-5 ml-7 w-auto z-1"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= SECTION 3 ================= */}
            <section id={"recursos"} className="max-w-6xl mx-auto px-8 py-20">
                <h2 className="text-4xl font-extrabold text-brand mb-3 reveal fade-left">
                    Venda mais com iMenu
                    <br/><span className={"text-text"}>e lucre mais</span>
                </h2>
                <p className="text-gray-500 mb-18 max-w-xl reveal fade-left delay-200">
                    Compare os benefícios entre o iMenu e outros cardápios digitais:
                </p>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-auto md:w-[80%] m-auto border-collapse rounded-sm overflow-hidden">
                        <thead className="text-left border-b border-gray-200">
                        <tr className="bg-gray-100">
                            <th className="p-4 font-medium border-r border-gray-200">Recursos</th>
                            <th className="p-4 font-medium border-r border-gray-200"><img src={"/logos/CombinationMarkLogo_Black.png"} className="w-18 opacity-70"/></th>
                            <th className="p-4 font-medium">Concorrentes</th>
                        </tr>
                        </thead>

                        <tbody className="[&>tr:nth-child(even)]:bg-gray-50 [&>tr:nth-child(odd)]:">
                        {restCount >= 0 && (
                        <tr >
                            <td className="p-4 border-r border-gray-200 font-light"><BonusButton className={"!cursor-text"}><span className={"inline-block"}><span className={"font-medium"}>BÔNUS</span> <span className={"font-light"}>para os prox. {restCount} restaurantes</span></span></BonusButton></td>
                            <td className="p-4 border-r border-gray-200 text-center leading-tight">Consultoria com time<br/> que já assessorou 1M+/mês</td>
                            <td className="p-4 border-r border-gray-200 text-center">-</td>
                        </tr>
                        )}
                        <tr>
                            <td className="p-4 border-r border-gray-200 ">Totalmente grátis, para sempre</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 border-r border-gray-200 text-center">Mensalidade e taxas</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Pedidos ilimitados</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 border-r border-gray-200 text-center">Cada vez mais caro</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Converte o cliente</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 border-r border-gray-200 text-center">Baixa Conversão</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Gestor de pedidos</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 border-r border-gray-200 text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Suporte humanizado</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip size={"medium"} text={<span>Suporte <b>humanizado</b> em horário comercial via Whatsapp. Todos os dias.</span>}><u className={"cursor-pointer"}>Todos os dias</u></Tooltip></td>
                            <td className="p-4 text-center">Robô, fila ou e-mail</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Integração com iFood</td>
                            <td className="p-4 border-r border-gray-200 text-center">Sincronização contínua</td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Acompanhamento do pedido</td>
                            <td className="p-4 border-r border-gray-200 text-center">Notificações via Whatsapp</td>
                            <td className="p-4 border-r border-gray-200 text-center">Clientes ficam perdidos</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Calcular Taxa de Entrega</td>
                            <td className="p-4 border-r border-gray-200 text-center">Pelo Raio</td>
                            <td className="p-4 text-center">Limitado ou manual</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Taxa por Transação</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Taxa de transação bancária.</span>}><u className={"cursor-pointer"}>0.99%</u></Tooltip></td>
                            <td className="p-4 border-r border-gray-200 text-center">5%, 15%, 30%</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">Scan de Cardápio com IA</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Nossa IA realiza o Scan da foto ou PDF do seu cardápio.</span>}><u className={"cursor-pointer"}>Pronto em segundos</u></Tooltip></td>
                            <td className="p-4 text-center">Manual</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Fotos e Vídeos dos produtos</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Baixa qualidade</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">Customização de opcionais</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">Identidade visual personalizada</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Sem marca d'água</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Com marca d'água</td>
                        </tr>


                        <tr>
                            <td className="p-4 border-r border-gray-200">Link para WhatsApp e redes</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>



                        <tr>
                            <td className="p-4 border-r border-gray-200">Google Analytics Integrado</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">Pixel Facebook Integrado</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">Painel Financeiro</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>



                        <tr>
                            <td className="p-4 border-r border-gray-200">Sistema em nuvem</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>




                        <tr>
                            <td className="p-4 border-r border-gray-200">Impressão dos pedidos</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>

                        <tr>
                            <td className="p-4 border-r border-gray-200">QR Code na mesa</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock}  className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Nem sempre disponível</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Cupons de desconto</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Pouca customização</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Agendamento de pedido</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Pedidos via Instagram / Facebook</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Rastreio de Motoboy</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Clientes ficam perdidos</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">CRM</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faXmark} className={"text-red"}/></td>
                            <td className="p-4 text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Comanda Mobile</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faXmark} className={"text-red"}/></td>
                            <td className="p-4 text-center">Taxas adicionais</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">ChatBot & Robô WhatsApp</td>
                            <td className="p-4 border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faXmark} className={"text-red"}/></td>
                            <td className="p-4 text-center">Taxas adicionais</td>
                        </tr>

                        </tbody>
                    </table>
                </div>

            </section>

            <Footer /> {/* ✅ FOOTER AQUI */}

        </div>
    );
}

"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
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
            const totalBonus = 20 + 10 //+10 for test restaurants
            setRestCount(totalBonus - ((await fetch("/api/restaurants/count").then(r => r.json())).count))
        })();
    }, []);

    useEffect(() => {
        document.title = "iMenu - Cardápio Digital";
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
        <div className="w-full max-w-screen overflow-x-hidden">

            {/* ================= NAVBAR ================= */}
            <header className="w-full flex flex-col md:flex-row gap-4 md:gap-0 items-center justify-between py-7 md:py-5 2xl:py-8 px-8 border-gray-200 bg-white">
                {/* Left – Logo */}
                <div className="flex items-center gap-2 text-xl font-bold text-brand">
                    {/* Logo placeholder */}
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        width={120}
                        height={32}
                        className="h-6 w-auto ml-4 cursor-pointer 2xl:h-10 2xl:ml-8"
                        onClick={() => router.push("#")}
                    />
                </div>

                {/* Right */}
                <nav className="flex z-30 md:z-auto items-center gap-8 text-sm font-medium 2xl:text-[1.2rem] 2xl:gap-11">
                    <a href="#" className="hover:text-gray-500 transition hidden md:block">Home</a>
                    <a href="#recursos" className="hover:text-gray-500 transition hidden md:block">Recursos</a>
                    {restCount > 0 && (
                        <Tooltip text={<span>Para os próximos {restCount} restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"} onClick={() => router.push("/restaurante/registrar")}>Cadastre-se agora</u></span>} size={"medium"} padding={"p-4 2xl:p-6"} position={"bottom"}>
                            <BonusButton><span className="inline-block"><span className={"text-[0.8rem] 2xl:text-[1.1rem]"}>BÔNUS</span> <span className="font-light">para prox. {restCount} restaurantes</span></span></BonusButton>
                        </Tooltip>
                    )}

                    <div className="w-[1px] h-6 2xl:h-8 bg-gray-300 hidden md:block" />

                    <a onClick={() => router.push("/restaurante/login")} className="hidden md:flex cursor-pointer items-center gap-1 hover:text-gray-500 transition text-gray-600">
                        <FontAwesomeIcon icon={icons.faUser} />
                        Login
                    </a>

                    <Button className={"!hidden md:!block"} variant="primary" onClick={() => router.push("/restaurante/registrar")}>
                        Registrar Grátis
                    </Button>
                </nav>
            </header>

            {/* ================= SECTION 1 ================= */}
            <section className=" relative text-center md:text-left mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 px-6 md:px-15 2xl:px-20 py-0 md:py-20 h-full md:h-[89svh] ">

                {/* Left – Text */}
                <div className="flex flex-col justify-start md:justify-center -mt-10 md:mt-0">

                    <div className="flex items-center justify-center">

                            <div className="h-120 w-100 relative overflow-hidden md:hidden top-0 2xl:mt-1 z-1">
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

                    <h1 className="text-2xl md:text-5xl 2xl:text-[4rem]  font-extrabold mb-2 mt-6 md:-mt-4 text-brand leading-tight ">
                        O novo Cardápio Digital
                        <br/><span className={"text-text"}>100% Gratuito</span>
                    </h1>


                    <h2 className="text-gray-500 leading-normal mt-4 md:mt-0 md:leading-15 2xl:leadin-24 2xl:text-[1.4rem]">
                        Cardápio digital para Restaurantes e Delivery. Pronto em 5 minutos.
                    </h2>



                    <div className="text-gray-500 2xl:text-[1.4rem] mt-5 md:mt-0 hidden md:block">
                        Sem taxas, sem pegadinhas.{" "}
                        <Tooltip text={"O iMenu é completamente grátis, para sempre."} position={"right"}><a href={"#recursos"} className="underline cursor-pointer">Para sempre.</a></Tooltip>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-4 mt-6 2xl:mt-9 2xl:gap-6">
                        <Button variant="primary" onClick={() => router.push("/restaurante/registrar")} className="px-6 py-3 text-lg 2xl:px-10 2xl:py-4 2xl:text-[1.6rem]">
                            Registrar Grátis
                        </Button>
                        {restCount > 0 && (
                            <Tooltip text={<span>Para os próximos {restCount} restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"} onClick={() => router.push("/restaurante/registrar")}>Cadastre-se agora</u></span>} size={"medium"} padding={"p-4 2xl:p-6"} position={"bottom"}><BonusButton className={"hidden md:inline-flex"}><span className=" font-regular text-xs 2xl:text-[1.1rem]">BÔNUS</span></BonusButton></Tooltip>
                        )}
                        <div className="w-[1px] h-6 bg-gray-300" />

                        <a onClick={() => router.push("/restaurante/login")} className="cursor-pointer flex items-center gap-1 hover:text-gray-500 transition text-gray-600 2xl:text-xl">
                            <FontAwesomeIcon icon={icons.faUser} />
                            Login
                        </a>

                    </div>

                </div>
                {/* Right – Video placeholder (image) */}
                <div className="flex items-center justify-center">
                    <div className="absolute h-[100%] w-100 overflow-hidden hidden md:block top-0 2xl:mt-1">
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
            <section className="py-16 2xl:py-26 px-8 h-auto md:h-[100vh] ">
                <h2 className="text-center text-3xl md:text-4xl 2xl:text-[3.2rem] font-extrabold text-brand mb-4 md:mb-13 2xl:mb-20 reveal fade-up">
                    Totalmente Grátis<br/>
                    <span className={"text-text text-2xl md:text-[100%]"}>sem taxas, sem pegadinhas</span>
                </h2>

                <div className="x-4 md:mx-18 flex flex-col md:flex-row gap-4 md:gap-12">

                    {/* LEFT – Logos + Image */}
                    <div className="flex gap-8 md:gap-10 2xl:gap-16 items-center md:items-start h-auto flex-1 flex-col md:flex-row">

                        {/* Logos */}
                        <div id={"logos"} className="reveal fade-up h-[100%] flex flex-row md:flex-col gap-5 2xl:gap-8 pt-4 items-center justify-center">
                            {logos.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => setSelected(l.id)}
                                    className={`transition rounded-full p-1 ${
                                        selected === l.id ? "scale-125 md:scale-115 opacity-100" : "opacity-66"
                                    }`}
                                >
                                    <div onClick={() => shouldRun.current = false} className="cursor-pointer w-12 h-12 2xl:w-20 2xl:h-20 rounded-full  hover:scale-110 duration-200 overflow-hidden bg-gray-200 flex items-center justify-center">
                                        <Image
                                            src={l.src}
                                            alt={l.name}
                                            width={50}
                                            height={50}
                                            className={`w-full h-full object-contain transition ${
                                                selected === l.id ? "grayscale-0" : "grayscale-75 md:grayscale-50"
                                            }`}                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Main image */}
                        <div className="md:reveal md:fade-right delay-300 flex-1 flex flex-col md:flex-row  gap-8 2xl:gap-12 relative h-full z-50">
                            <div className={"w-full md:w-[45%] 2xl:w-[50%]"}>
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
                                        className="h-full w-auto drop-shadow-[-5px_-5px_5px_rgba(0,0,0,0.1)] md:drop-shadow-[0px_5px_5px_rgba(0,0,0,0.1)] rounded-xl 2xl:rounded-2xl"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-12 2xl:gap-20 w-full  md:w-[43%] ml-0 mt-4 md:mt-0 md:ml-3  text-center md:text-left  justify-center z-40">
                                <div>
                                    <h3 className="text-lg 2xl:text-[1.5rem] font-bold mb-1">Venda sem taxas</h3>
                                    <p className="text-gray-500 2xl:text-xl">Receba 100% do valor que você vendeu.</p>
                                </div>
                                <div>
                                    <h3 className="text-lg 2xl:text-[1.5rem] font-bold mb-1">Criado em 5 minutos</h3>
                                    <div className="text-gray-500 z-50 2xl:text-xl">A <Tooltip className={"z-50"} text={"Nossa IA realiza o scan da foto ou PDF do seu cardápio."} position={"right"}><u className={"cursor-pointer"}>Inteligência Artificial</u></Tooltip> reconhece a foto do seu cardápio.</div>
                                </div>

                                <Button variant="primary" onClick={() => router.push("/restaurante/registrar")} className="px-6 py-3 text-lg mb-3 2xl:px-10 2xl:py-4 2xl:text-[1.6rem]">
                                    Registrar Grátis
                                </Button>

                            </div>
                        </div>
                    </div>

                    {/* RIGHT – Big image */}
                    <div className="flex items-center justify-center relative md:h-[63svh] flex-1 z-1 mt-10 md:mt-0">
                        <div className="relative h-full w-full delay-500 reveal fade-left z-1">
                            <Image
                                src="/images/MonitorGraph.png"
                                alt="Destaque do painel e resultados"
                                width={1080}
                                height={1920}
                                className="h-[105%] ml-0 mt-0 md:-mt-5 md:ml-7 w-auto z-1 2xl:ml-20 2xl:-mt-10"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= SECTION 3 ================= */}
            <section id={"recursos"} className="mx-0 md:mx-24 2xl:mx-38 px-4 md:px-8 pt-30 md:py-20">
                <h2 className="text-4xl 2xl:text-[3.2rem] font-extrabold text-brand mb-3 reveal fade-left text-center md:text-left">
                    Venda mais <span className={"hidden md:inline-block"}>com iMenu</span>
                    <br/><span className={"text-text"}>e lucre mais</span>
                </h2>
                <h2 className="text-gray-500 mb-12 md:mb-18 2xl:text-xl 2xl:mb-24 reveal fade-left delay-200 text-center md:text-left">
                    Compare os benefícios entre o iMenu e outros cardápios digitais:
                </h2>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-auto md:w-[80%] m-auto border-collapse rounded-sm 2xl:rounded-lg 2xl:text-[1.4rem] overflow-hidden">
                        <thead className="text-left border-b border-gray-200">
                        <tr className="bg-gray-100">
                            <th className="p-4 2xl:p-6 font-medium border-r border-gray-200">Recursos</th>
                            <th className="p-4 2xl:p-6 font-medium border-r border-gray-200"><img src={"/logos/CombinationMarkLogo_Black.png"} className="w-18 opacity-70 2xl:w-24"/></th>
                            <th className="p-4 2xl:p-6 font-medium">Concorrentes</th>
                        </tr>
                        </thead>

                        <tbody className="[&>tr>td]:p-4 [&>tr>td]:2xl:p-6 [&>tr:nth-child(even)]:bg-gray-50 [&>tr:nth-child(odd)]:">
                        {restCount > 0 && (
                        <tr >
                            <td className=" border-r border-gray-200 md:font-light text-sm md:text-[100%]"><BonusButton className={"hidden md:inline-flex"}><span className={"inline-block"}><span className={"font-medium"}>BÔNUS</span> <span className={"font-light"}>para os prox. {restCount} restaurantes</span></span></BonusButton><span className={"block md:hidden"}><b>BÔNUS</b> para os prox. {restCount} restaurantes</span></td>
                            <td className=" border-r border-gray-200 text-center leading-tight text-xs md:text-[100%]">Consultoria com time<br/> que já assessorou 1M+/mês</td>
                            <td className=" border-gray-200 text-center">-</td>
                        </tr>
                        )}
                        <tr>
                            <td className=" border-r border-gray-200 ">Totalmente grátis, para sempre</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="  border-gray-200 text-center">Mensalidade e taxas</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Pedidos ilimitados</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="  border-gray-200 text-center">Cada vez mais caro</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Converte o cliente</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="  border-gray-200 text-center">Baixa Conversão</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Gestor de pedidos (balcão)</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className="  border-gray-200 text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Suporte humanizado</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip size={"medium"} text={<span>Suporte <b>humanizado</b> em horário comercial via Whatsapp. Todos os dias.</span>}><u className={"cursor-pointer"}>Todos os dias</u></Tooltip></td>
                            <td className=" text-center">Robô, fila ou e-mail</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Integração com iFood</td>
                            <td className=" border-r border-gray-200 text-center">Sincronização contínua</td>
                            <td className=" text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Acompanhamento do pedido</td>
                            <td className=" border-r border-gray-200 text-center">Notificações via Whatsapp</td>
                            <td className="  border-gray-200 text-center">Clientes ficam perdidos</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Calcular Taxa de Entrega</td>
                            <td className=" border-r border-gray-200 text-center">Pelo Raio</td>
                            <td className=" text-center">Configurações confusas</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Taxa por Transação</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Taxa de transação bancária.</span>}><u className={"cursor-pointer"}>0.99%</u></Tooltip></td>
                            <td className="  border-gray-200 text-center">5%, 15%, 30%</td>
                        </tr>

                        <tr>
                            <td className=" border-r border-gray-200">Scan de Cardápio com IA</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Nossa IA realiza o Scan da foto ou PDF do seu cardápio.</span>}><u className={"cursor-pointer"}>Pronto em segundos</u></Tooltip></td>
                            <td className=" text-center">Manual</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Fotos e Vídeos dos produtos</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Baixa qualidade</td>
                        </tr>

                        <tr>
                            <td className=" border-r border-gray-200">Customização de opcionais</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className=" border-r border-gray-200">Identidade visual personalizada</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Limitado</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Sem marca d'água</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Com marca d'água</td>
                        </tr>


                        <tr>
                            <td className=" border-r border-gray-200">Link para WhatsApp e redes</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Limitado</td>
                        </tr>





                        <tr>
                            <td className=" border-r border-gray-200">Painel Financeiro</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Limitado</td>
                        </tr>



                        <tr>
                            <td className=" border-r border-gray-200">Sistema em nuvem</td>
                            <td className=" border-r border-gray-200 text-center"><FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/></td>
                            <td className=" text-center">Não</td>
                        </tr>


                        <tr>
                            <td className=" border-r border-gray-200">Google Analytics Integrado</td>
                            <td className=" border-r border-gray-200 text-center">
                                <FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/>
                            </td>
                            <td className=" text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className=" border-r border-gray-200">Pixel Meta (Facebook/Instagram) Integrado</td>
                            <td className=" border-r border-gray-200 text-center">
                                <FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/>
                            </td>
                            <td className=" text-center">Limitado</td>
                        </tr>

                        <tr>
                            <td className=" border-r border-gray-200">Impressão dos pedidos</td>
                            <td className=" border-r border-gray-200 text-center">Manual</td>
                            <td className=" text-center">Não</td>
                        </tr>


                        <tr>
                            <td className=" border-r border-gray-200">Cupons de desconto</td>
                            <td className=" border-r border-gray-200 text-center">
                                <FontAwesomeIcon icon={icons.faCheck} className={"text-green"}/>
                            </td>
                            <td className=" text-center">Pouca customização</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Agendamento de pedido</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className=" text-center">Não</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">QR Code na mesa</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock}  className={"text-orange"}/></Tooltip></td>
                            <td className=" text-center">Nem sempre disponível</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Pedidos via Instagram / Facebook</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className=" text-center">Não</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Rastreio de Motoboy</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock} className={"text-orange"}/></Tooltip></td>
                            <td className=" text-center">Clientes ficam perdidos</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">Comanda Mobile</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={icons.faClock}  className={"text-orange"}/></Tooltip></td>
                            <td className=" text-center">Taxas adicionais</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">ChatBot & Robô WhatsApp</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Não é uma prioridade no momento.</span>} color={"bg-red"}><FontAwesomeIcon icon={icons.faClock} className={"text-red"}/></Tooltip></td>
                            <td className=" text-center">Taxas adicionais</td>
                        </tr>
                        <tr>
                            <td className=" border-r border-gray-200">CRM</td>
                            <td className=" border-r border-gray-200 text-center"><Tooltip text={<span>Não é uma prioridade no momento.</span>} color={"bg-red"}><FontAwesomeIcon icon={icons.faClock} className={"text-red"}/></Tooltip></td>
                            <td className=" text-center">Limitado</td>
                        </tr>

                        </tbody>
                    </table>
                </div>

            </section>

            <Footer /> {/* ✅ FOOTER AQUI */}

        </div>
    );
}

"use client";

import Image from "next/image";
import BonusButton from "@/components/ui/BonusButton";
import Button from "@/components/ui/Button";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/fontawesome";
import Tooltip from "@/components/ui/Tooltip";
import Footer from "@/components/Footer";

export default function LandingPage() {
    // SECTION 2 – troca de imagem
    const logos = [
        { id: 1, name: "Logo 1", src: "/imenu.png", second_src:"/iMenu MENU.png" },
        { id: 2, name: "Logo 2", src: "/imenu.png", second_src:"/iMenu MENU.png" },
        { id: 3, name: "Logo 3", src: "/imenu.png", second_src:"/iMenu MENU.png" },
    ];
    const [selected, setSelected] = useState(1);

    return (
        <div className="w-full">

            {/* ================= NAVBAR ================= */}
            <header className="w-full flex items-center justify-between py-5 px-8 border-gray-200 bg-white">
                {/* Left – Logo */}
                <div className="flex items-center gap-2 text-xl font-bold text-brand">
                    {/* Logo placeholder */}
                    <Image
                        src="/logo-full.png"
                        alt="iMenu Logo"
                        width={120}
                        height={32}
                        className="h-6 w-auto ml-4 cursor-pointer"
                    />
                </div>

                {/* Right */}
                <nav className="flex items-center gap-8 text-sm font-medium">
                    <a href="#" className="hover:text-gray-500 transition">Home</a>
                    <a href="#" className="hover:text-gray-500 transition">Recursos</a>
                    <Tooltip text={<span>Para os próximos 26 restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"}>Saiba mais</u></span>} size={"medium"} padding={"p-4"} position={"bottom"}><BonusButton><span className="inline-block"><span className={"text-[0.8rem]"}>BÔNUS</span> <span className="font-light">para prox. 26 restaurantes</span></span></BonusButton></Tooltip>


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

                {/* Left – Text */}
                <div className="flex flex-col justify-center">
                    <h1 className="text-5xl font-extrabold mb-2 -mt-4 text-brand leading-tight ">
                        O novo Cardápio Digital
                        <br/><span className={"text-text"}>de Alta Conversão</span>
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

                        <Tooltip text={<span>Para os próximos 26 restaurantes que se cadastrarem: Consultoria grátis de 30 minutos com time que já assessorou 1M+/mês. <u className={"cursor-pointer"}>Saiba mais</u></span>} size={"medium"} padding={"p-4"} position={"right"}><BonusButton><span className="font-regular text-xs">BÔNUS</span></BonusButton></Tooltip>
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
                                            }`}                                        />
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
                                    <p className="text-gray-500">A Inteligência Artificial reconhece a foto do seu cardápio.</p>
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
                                src="/images/MonitorGraph.png"
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
            <section className="max-w-6xl mx-auto px-8 py-12">
                <h2 className="text-4xl font-extrabold text-brand mb-3">
                    Em média, mais 30% pedidos
                    <br/><span className={"text-text"}>em 3 meses</span>
                </h2>
                <p className="text-gray-500 mb-18 max-w-xl">
                    Baseado em X restaurantes cadastrados.
                </p>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-auto md:w-[80%] m-auto border-collapse rounded-sm overflow-hidden">
                        <thead className="text-left border-b border-gray-200">
                        <tr className="bg-gray-100">
                            <th className="p-4 font-medium border-r border-gray-200">Recursos</th>
                            <th className="p-4 font-medium border-r border-gray-200"><img src={"logo-full-black.png"} className="w-18 opacity-80"/></th>
                            <th className="p-4 font-medium">Concorrentes</th>
                        </tr>
                        </thead>

                        <tbody className="[&>tr:nth-child(even)]:bg-gray-50 [&>tr:nth-child(odd)]:">
                        <tr >
                            <td className="p-4 border-r border-gray-200 font-light"><BonusButton><span className={"inline-block"}><span className={"font-medium"}>BÔNUS</span> <span className={"font-light"}>para os prox. 26 restaurantes</span></span></BonusButton></td>
                            <td className="p-4 border-r border-gray-200 text-center leading-tight">Consultoria com time<br/> que já assessorou 1M+/mês</td>
                            <td className="p-4 border-r border-gray-200 text-center">-</td>
                        </tr>
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
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={faClock}  className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Nem sempre disponível</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Cupons de desconto</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Pouca customização</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Agendamento de pedido</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Pedidos via Instagram / Facebook</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={faClock} className={"text-orange"}/></Tooltip></td>
                            <td className="p-4 text-center">Não</td>
                        </tr>
                        <tr>
                            <td className="p-4 border-r border-gray-200">Rastreio de Motoboy</td>
                            <td className="p-4 border-r border-gray-200 text-center"><Tooltip text={<span>Funcionalidade em desenvolvimento.</span>} color={"bg-orange"}><FontAwesomeIcon icon={faClock} className={"text-orange"}/></Tooltip></td>
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
